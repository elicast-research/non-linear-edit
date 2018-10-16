import ElicastOT, { OtInsertSuccess, OtInsertConflict } from '@/elicast/elicast-ot'
import {
  ElicastRecordStart, ElicastRecordEnd, ElicastSelection,
  ElicastText, ElicastRun
} from '@/elicast/elicast-ot-set'
import Elicast from '@/elicast/elicast'
import ElicastService from '@/elicast/elicast-service'
import ElicastOTAreaSet from '@/elicast/elicast-ot-area-set';
import SoundManager from '@/components/sound-manager'
import Slider from '@/components/Slider'
import RunOutputView from '@/components/RunOutputView'
import Toast from '@/components/Toast'
import { codemirror } from 'vue-codemirror'
import 'codemirror/addon/selection/mark-selection.js'
import 'codemirror/mode/python/python.js'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/solarized.css'
import _ from 'lodash'
import dateFormat from 'date-fns/format'
import ConflictResolver from '@/components/ConflictResolver'

class PlayMode {
  static PLAYBACK = new PlayMode('playback')
  static PAUSE = new PlayMode('pause')
  static STANDBY = new PlayMode('standby')
  static RECORD = new PlayMode('record')
  static RECORD_PAST = new PlayMode('record_past')
  static TIMELINE_SELECT = new PlayMode('timeline_select')
  static TEXT_SELECT = new PlayMode('text_select')

  constructor (name) {
    this.name = name
  }

  toString () {
    return this.name
  }

  isRecording () {
    return [PlayMode.RECORD, PlayMode.RECORD_PAST].includes(this)
  }
}

class PlayAreaType {
  static TEXT = new PlayAreaType('text')

  constructor (name) {
    this.name = name
  }

  toString () {
    return this.name
  }
}

const EDITOR_OPTIONS = {
  mode: 'python',
  theme: 'solarized',
  lineNumbers: true,
  cursorBlinkRate: 0, // disable default blinker which is not working in no-focus state
  showCursorWhenSelecting: true,
  indentWithTabs: false,
  autofocus: true,
  indentUnit: 4,
  tabSize: 4,
  extraKeys: {
    'Tab': function (cm) {
      if (cm.somethingSelected())
        cm.indentSelection('add')
      else
        cm.execCommand('insertSoftTab')
    },
    'Shift-Tab': function (cm) {
      cm.indentSelection('subtract')
    }
  }
}

const CURSOR_BLINK_RATE = 530 // CodeMirror default cursorBlinkRate: 530ms
const PLAYBACK_TICK = 1000 / 120
const RECORD_TICK = 1000 / 10

export default {
  props: {
    elicast: {
      type: Object
    }
  },

  data () {
    return {
      PlayMode,
      PlayAreaType,

      code: '',
      elicastId: this.elicast ? this.elicast.id : null,
      elicastTitle: this.elicast ? this.elicast.title : 'Untitiled',
      ots: this.elicast ? this.elicast.ots : [],
      ts: -1,
      prevPlayMode: PlayMode.STANDBY,
      playMode: PlayMode.STANDBY,
      playAreaType: PlayAreaType.TEXT,
      playModeReady: true,
      historySelection: {},
      maxTs: 0,
      recordStartOt: null,
      recordPastOts: null,
      soundManager: new SoundManager('audio/webm', this.elicast ? this.elicast.voiceBlobs : null),
      runOutput: null,
      playbackSound: null,
      playbackStartTs: -1,
      playbackStartTime: -1,

      cursorBlinkTimer: -1,
      recordTimer: -1,
      playbackTimer: -1,

      cm: null,
      logger: null
    }
  },

  computed: {
    editorOptions () {
      return Object.assign({
        readOnly: this.playMode.isRecording() ? false : 'nocursor'
      }, EDITOR_OPTIONS)
    },
    tsDisplay () {
      return dateFormat(this.ts, 'm:ss') + ' / ' + dateFormat(this.maxTs, 'm:ss')
    },
    sliderColor () {
      return this.playMode.isRecording() ? 'red' : 'black'
    },
    sliderTicks () {
      // This function can be called before the change callback of `playMode`
      // , thus need to check whether `recordStartOt` is properly set or yet
      if (this.playMode === PlayMode.RECORD_PAST && this.recordStartOt !== null) {
        const replacedTsInterval = this.historySelection.toTs - this.historySelection.fromTs
        const insertTsInterval = this.ts - this.recordStartOt.ts

        return this.ots.filter(ot => ot instanceof ElicastText)
          .map(ot => ot.ts > this.recordStartOt.ts ? ot.ts + insertTsInterval - replacedTsInterval : ot.ts)
      }
      return this.ots.filter(ot => ot instanceof ElicastText).map(ot => ot.ts)
    },
    sliderOverlays () {
      // const overlayColors = {
      //   [ElicastExercise]: '#E1BEE7',
      //   [ElicastAssert]: '#FFCDD2'
      // }
      //
      // return ElicastOT
      //   .getSegments(this.ots)
      //   .map(segment => ({
      //     from: segment.fromTs,
      //     to: segment.toTs,
      //     color: overlayColors[segment.type]
      //   }))
    },
    currentElicast () {
      return new Elicast(this.elicastId, this.elicastTitle, this.ots, this.soundManager.chunks)
    }
  },

  watch: {
    ts (ts, prevTs) {
      if (ts > this.maxTs) {
        this.maxTs = ts
      }
      this.$refs.slider.val = ts

      // while recording, changes are directly made in the editor
      if (this.playMode.isRecording()) return

      // forward / rewind the document
      let prevOtIdx = this.ots.findIndex(ot => prevTs < ot.ts)
      prevOtIdx = (prevOtIdx < 0 ? this.ots.length : prevOtIdx) - 1
      let newOtIdx = this.ots.findIndex(ot => ts < ot.ts)
      newOtIdx = (newOtIdx < 0 ? this.ots.length : newOtIdx) - 1

      if (prevOtIdx === newOtIdx) {
        if (ts === this.maxTs) {
          this.transitionMode('MAX_TS')
        }
        return
      }

      let shouldRedrawOTArea = false
      let shouldRedrawRunOutput = false
      let shouldRestartPlaybackSound = false

      const isBigJump = Math.abs(newOtIdx - prevOtIdx) > 10

      if (isBigJump) {
        const targetOts = this.ots.slice(0, newOtIdx + 1)
        this.cm.setValue(ElicastOT.buildText(targetOts))

        const lastTextOt = ElicastOT.getLastOtForOtType(targetOts, ElicastText)
        if (lastTextOt) {
          // To set cursor position by last ElicastText
          ElicastOT.revertOtToCM(this.cm, lastTextOt)
          ElicastOT.applyOtToCM(this.cm, lastTextOt)
        }
      }

      // prevOtIdx < newOtIdx
      for (let i = prevOtIdx + 1; i <= newOtIdx && i < this.ots.length; i++) {
        const ot = this.ots[i]

        if (ot instanceof ElicastSelection) continue

        if (!(isBigJump && ot instanceof ElicastText)) {
          ElicastOT.applyOtToCM(this.cm, ot)
        }

        if (ot instanceof ElicastText) {
          shouldRedrawOTArea = true
        } else if (ot instanceof ElicastRun) {
          shouldRedrawRunOutput = true
        } else if (ot instanceof ElicastRecordStart) {
          shouldRestartPlaybackSound = true
        }
      }
      // prevOtIdx > newOtIdx
      for (let i = prevOtIdx; i > newOtIdx && i >= 0; i--) {
        const ot = this.ots[i]

        if (ot instanceof ElicastSelection) continue

        if (!(isBigJump && ot instanceof ElicastText)) {
          ElicastOT.revertOtToCM(this.cm, ot)
        }

        if (ot instanceof ElicastText) {
          shouldRedrawOTArea = true
        } else if (ot instanceof ElicastRun) {
          shouldRedrawRunOutput = true
        }
      }

      //only draw OTArea during timeline selection
      shouldRedrawOTArea = shouldRedrawOTArea && this.playMode === PlayMode.TIMELINE_SELECT

      // if playMode is not playback, always redraw when ts changes
      shouldRedrawRunOutput = shouldRedrawRunOutput || this.playMode !== PlayMode.PLAYBACK
      shouldRestartPlaybackSound = shouldRestartPlaybackSound && this.playMode === PlayMode.PLAYBACK

      if (shouldRedrawOTArea) {
        this.redrawOTArea()
      }

      // restore run output
      if (shouldRedrawRunOutput) {
        this.redrawRunOutput()
      }

      if (shouldRestartPlaybackSound) {
        this.restartPlaybackSound()
      }

      // restore selection
      this.redrawSelection()
      if (ts === this.maxTs) {
        this.transitionMode('MAX_TS')
      }
    },

    async playMode (playMode, prevPlayMode) {
      this.logger.submit('watch-play-mode', {
        'id': this.elicastId,
        'prev': prevPlayMode,
        'next': playMode,
        'ts': this.ts
      })

      if (!prevPlayMode.isRecording() && playMode === PlayMode.RECORD) {
        // start recording
        const soundChunkIdx = await this.soundManager.record()

        // the last OT is a 'nop' OT marking the end of the last recording
        const lastTs = this.ots.length ? this.ots[this.ots.length - 1].ts : 0
        this.recordStartOt = new ElicastRecordStart(lastTs, soundChunkIdx)
        this.ots.push(this.recordStartOt)

        if (this.recordTimer !== -1) throw new Error('recordTimer is not cleared')
        this.recordTimer = setInterval(this.recordTick, RECORD_TICK)
      } else if (playMode === PlayMode.RECORD_PAST) {
        // start recording
        const soundChunkIdx = await this.soundManager.record()

        this.recordStartOt = new ElicastRecordStart(this.historySelection.fromTs, soundChunkIdx)
        this.recordPastOts = [
          new ElicastRecordEnd(this.historySelection.fromTs - 1),
          this.recordStartOt
        ]

        if (this.recordTimer !== -1) throw new Error('recordTimer is not cleared')
        this.recordTimer = setInterval(this.recordTick, RECORD_TICK)
      } else if (prevPlayMode === PlayMode.RECORD && !playMode.isRecording()) {
        // end recording
        await this.soundManager.stopRecording()

        const ts = this.recordStartOt.getRelativeTS()
        this.ots.push(new ElicastRecordEnd(ts))
        this.recordStartOt = null

        clearInterval(this.recordTimer)
        this.recordTimer = -1
      } else if (prevPlayMode === PlayMode.RECORD_PAST) {
        // end recording
        await this.soundManager.stopRecording()

        const recordStartTs = this.recordStartOt.ts
        const recordEndTs = this.recordStartOt.getRelativeTS()
        this.recordPastOts.push(new ElicastRecordEnd(recordEndTs))

        const replacedTsInterval = this.historySelection.toTs - this.historySelection.fromTs
        const insertTsInterval = recordEndTs - this.recordStartOt.ts

        const lastRecordStartOt = ElicastOT.getLastOtForOtType(
          this.ots, ElicastRecordStart, recordStartTs)
        const soundOffset = (recordStartTs - lastRecordStartOt.ts) +
          lastRecordStartOt.soundOffset +
          replacedTsInterval
        this.recordPastOts.push(new ElicastRecordStart(
          recordEndTs + 1, lastRecordStartOt.soundChunkIdx, Date.now(), soundOffset))

        let replaceStartIdx = this.ots.findIndex(ot => ot.ts >= this.historySelection.fromTs)
        if (replaceStartIdx < 0) replaceStartIdx = 0
        let replaceEndIdx = this.ots.findIndex(ot => ot.ts > this.historySelection.toTs)
        if (replaceEndIdx < 0) replaceEndIdx = this.ots.length

        const recordPastOts = this.recordPastOts

        this.logger.submit('resolve-start', {
          'id': this.elicastId,
          'ots': this.ots,
          'historySelection': this.historySelection,
          'replaceStartIdx': replaceStartIdx,
          'replaceEndIdx': replaceEndIdx,
          'recordPastOts': recordPastOts
        })

        this.recordStartOt = null
        this.recordPastOts = null
        this.historySelection = {}
        this.$refs.slider.dropSelection()

        clearInterval(this.recordTimer)
        this.recordTimer = -1

        const resolveOts = []
        while (true) {
          const result = ElicastOT.replacePartOfHistory(this.ots,
            replaceStartIdx,
            replaceEndIdx - replaceStartIdx,
            recordPastOts,
            resolveOts
          )

          if (result instanceof OtInsertConflict) {
            const resolveOt = await this.$refs.conflictResolver.openPromise(result, resolveOts)
            if (resolveOt !== null) {
              this.logger.submit('resolve-one', {
                'id': this.elicastId,
                'resolveOts': resolveOts,
                'resolveOt': resolveOt,
                'result': result
              })

              resolveOts.push(resolveOt)
            } else if (resolveOts.length > 0) {
              // cancel latest resolve
              this.logger.submit('resolve-undo', {
                'id': this.elicastId,
              })

              resolveOts.pop()
            } else {
              // cancel whole record (revert direct changes on CodeMirror during the recording)
              this.logger.submit('resolve-cancel', {
                'id': this.elicastId,
              })

              const lastExecutedOtIdx = _.findLastIndex(this.ots, ot => ot.ts <= recordEndTs)
              const recoveredText = ElicastOT.buildText(this.ots.slice(0, lastExecutedOtIdx + 1))
              this.cm.setValue(recoveredText)
              break
            }
          } else {
            this.logger.submit('resolve-done', {
              'id': this.elicastId,
              'resolveOts': resolveOts,
              'result': result
            })

            for (let i = replaceStartIdx + recordPastOts.length; i < result.ots.length; i++) {
              result.ots[i].ts += insertTsInterval - replacedTsInterval
            }
            this.ots = result.ots
            break
          }
        }

        // go back the starting point of recording
        this.ts = recordStartTs

        this.maxTs = this.ots[this.ots.length - 1].ts
      } else if (playMode === PlayMode.PLAYBACK) {
        // start playback
        if (this.playbackTimer !== -1) throw new Error('playbackTimer is not cleared')

        // restore selection
        this.redrawSelection()
        // restore run output
        this.redrawRunOutput()

        await this.restartPlaybackSound()

        this.playbackStartTs = this.ts
        this.playbackStartTime = Date.now()

        const tick = () => {
          this.playbackTick()
          this.playbackTimer = setTimeout(tick, PLAYBACK_TICK)
        }
        this.playbackTimer = setTimeout(tick, PLAYBACK_TICK)
      } else if (prevPlayMode === PlayMode.PLAYBACK) {
        // pause playback

        this.playbackSound.stop()
        this.playbackSound = null

        this.playbackStartTs = -1
        this.playStartTime = -1

        clearTimeout(this.playbackTimer)
        this.playbackTimer = -1
      } else if (prevPlayMode === PlayMode.TIMELINE_SELECT) {
        this.redrawOTArea()
      }

      // Give focus to the editor if new playMode is a recording state,
      // otherwise give focus to the control button
      _.defer(() => {
        if (this.playMode.isRecording()) this.cm.focus()
        else this.$refs.controlButton.focus()
      })

      this.prevPlayMode = prevPlayMode
      this.playModeReady = true
    }
  },

  created () {
    this.soundManager.preload()
  },

  mounted (t) {
    this.logger = this.$logger.getLogger('Editor')

    this.cursorBlinkTimer = this.cursorBlinkTick()

    this.cm = this.$refs.cm.codemirror
    this.cm.on('mousedown', this.handleEditorMousedown)
    window.addEventListener('resize', this.handleEditorResize)
    this.handleEditorResize()

    window.addEventListener('keydown', this.handleKeydown)

    this.ts = this.ots.length && this.ots[this.ots.length - 1].ts

    window.onbeforeunload = () =>
      'Do you want to leave this page? Changes you made may not be saved.'
  },

  beforeDestroy () {
    // stop sound if playing
    if (!_.isNull(this.playbackSound)) {
      this.playbackSound.stop()
      this.playbackSound = null
    }

    clearInterval(this.cursorBlinkTimer)
    window.removeEventListener('resize', this.handleEditorResize)

    window.removeEventListener('keydown', this.handleKeydown)

    window.onbeforeunload = null
  },

  methods: {
    redrawSelection () {
      const previousSelectionOt = ElicastOT.getLastOtForOtType(this.ots, ElicastSelection, this.ts)
      if (previousSelectionOt) ElicastOT.applyOtToCM(this.cm, previousSelectionOt)
    },
    redrawOTArea () {
      this.cm.doc.getAllMarks()
        .filter(marker => marker.className === 'added-ot-area')
        .forEach(marker => marker.clear())

      if (this.playMode === PlayMode.TIMELINE_SELECT) {
        const firstSelectedOtIdx = _.findIndex(this.ots, ot => this.$refs.slider.selectFrom <= ot.ts)
        const lastSelectedOtIdx = _.findIndex(this.ots, ot => this.ts < ot.ts)

        const cmContent = this.cm.doc.getValue()

        // We need to use `forceRemove`, thus cannot use `ElicastOT.getAreas`
        const areaSet = new ElicastOTAreaSet()
        for (let ot of this.ots.slice(firstSelectedOtIdx, lastSelectedOtIdx)) {
          switch (ot.constructor) {
            case ElicastText:
              if (ot.removedText.length > 0) {
                areaSet.forceRemove(ot.fromPos, ot.fromPos + ot.removedText.length)
              }
              if (ot.insertedText.length > 0) {
                areaSet.insert(ElicastOTAreaSet.TEXT, ot.fromPos, ot.fromPos + ot.insertedText.length, true)
              }
              break
          }
        }

        areaSet.toArray()
          .filter(area => area.type === ElicastOTAreaSet.TEXT)
          .forEach(area => {
            const fromLineCh = ElicastOT.posToLineCh(cmContent, area.fromPos)
            const toLineCh = ElicastOT.posToLineCh(cmContent, area.toPos)
            this.cm.doc.markText(fromLineCh, toLineCh, { className: 'added-ot-area' })
          })
      }
    },
    redrawRunOutput (runOt) {
      runOt = runOt || ElicastOT.getLastOtForOtType(this.ots, ElicastRun, this.ts)
      if (runOt) {
        this.runOutput = runOt.isRunning() ? '/* running... */' : runOt.output
      } else {
        this.runOutput = ''
      }
    },
    async restartPlaybackSound () {
      console.log('ha')
      if (!_.isNull(this.playbackSound)) {
        console.log('ho')
        this.playbackSound.stop()
        console.log('hu')
        this.playbackSound = null
        console.log('hi')
      }

      const lastRecordStartOt = ElicastOT.getLastOtForOtType(this.ots, ElicastRecordStart, this.ts)
      this.playbackSound = await this.soundManager.load(lastRecordStartOt.soundChunkIdx)
      console.log(lastRecordStartOt, this.playbackSound)
      this.playbackSound.seek((this.ts - lastRecordStartOt.ts + lastRecordStartOt.soundOffset) / 1000)
      this.playbackSound.play()
    },
    async runCode () {
      const targetOts = (this.playMode === PlayMode.RECORD_PAST) ? this.recordPastOts : this.ots

      let ts = this.recordStartOt.getRelativeTS()
      const runStartOT = new ElicastRun(ts)
      targetOts.push(runStartOT)
      this.redrawRunOutput(runStartOT)
      this.playModeReady = false

      const toast = this.$refs.toast.show({
        class: ['alert', 'alert-warning'],
        content: '<i class="fa fa-terminal"></i> Running...'
      })

      const [exitCode, output] = await ElicastService.runCode(this.code)

      ts = this.recordStartOt.getRelativeTS()
      const runResultOT = new ElicastRun(ts, exitCode, output)
      targetOts.push(runResultOT)
      this.redrawRunOutput(runResultOT)
      this.playModeReady = true

      this.$refs.toast.remove(toast)
    },
    async cutOts () {
      this.logger.submit('cut-ots', {
        'id': this.elicastId,
        'ts': this.ts
      })

      const firstCutOtIdx = this.ots.findIndex(ot => this.ts < ot.ts)
      if (firstCutOtIdx <= 0) return

      this.playModeReady = false

      const toast = this.$refs.toast.show({
        class: ['alert', 'alert-warning'],
        content: '<i class="fa fa-scissors"></i> Cutting...'
      })

      const lastRecordStartOt = _.findLast(this.ots, ot => ot.ts <= this.ts &&
        ot.constructor === ElicastRecordStart)
      const lastSoundChunkIdx = lastRecordStartOt.soundChunkIdx

      const reducedChunk = await ElicastService.splitAudio(
        [[0, this.ts - lastRecordStartOt.ts]], this.soundManager.chunks[lastSoundChunkIdx])
      this.soundManager.chunks.splice(
        lastSoundChunkIdx, this.soundManager.chunks.length - lastSoundChunkIdx, reducedChunk)
      await this.soundManager.preload()

      this.maxTs = this.ts
      this.ots.splice(firstCutOtIdx, this.ots.length - firstCutOtIdx)
      this.ots.push(new ElicastRecordEnd(this.ts + 1))  // Trick to invoke ts update
      this.ts += 1

      this.$refs.toast.remove(toast)

      this.playModeReady = true
    },
    pushRecordOt (ot) {
      switch (this.playMode) {
        case PlayMode.RECORD:
          this.ots.push(ot)
          break
        case PlayMode.RECORD_PAST:
          this.recordPastOts.push(ot)
          break
      }
    },
    handleEditorResize (e) {
      this.cm.setSize(null, document.documentElement.clientHeight - 200)
    },
    handleKeydown (e) {
      if (e.target !== this.$refs.controlButton) return

      if (e.key === 'ArrowLeft') {
        const prevOt = _.findLast(this.ots, ot => ot.ts < this.ts - 1)
        if (prevOt === undefined) return
        if (this.$refs.slider.isSelecting && this.$refs.slider.selectFrom > prevOt.ts) {
          this.ts = this.$refs.slider.selectFrom
        } else {
          this.ts = prevOt.ts + 1
        }
        this.transitionMode('SLIDER_MOUSEDOWN')
      } else if (e.key === 'ArrowRight') {
        const nextOt = this.ots.find(ot => ot.ts > this.ts)
        if (nextOt === undefined) return
        this.ts = nextOt.ts + 1
        this.transitionMode('SLIDER_MOUSEDOWN')
      }
    },
    handleEditorBeforeChange (cm, changeObj) {
      if (!this.playMode.isRecording()) return

      const ts = this.recordStartOt.getRelativeTS()
      const newOT = ElicastOT.makeOTFromCMChange(cm, changeObj, ts)

      this.pushRecordOt(newOT)
    },
    handleEditorChange (cm, changeObj) {
      if (!this.playMode.isRecording()) return

      // TODO: redraw some areas?
      // if (this.recordExerciseInitiated) {
      //   ElicastOT.redrawRecordingExerciseArea(this.cm,
      //     this.recordExerciseSession.getExerciseOTs())
      // } else if (this.recordAssertInitiated) {
      //   ElicastOT.redrawRecordingAssertArea(this.cm,
      //     this.recordAssertSession.getAssertOTs())
      // }
    },
    handleEditorCursorActivity (cm) {
      this.forceCursorBlink()

      if (!this.playMode.isRecording()) return

      const ts = this.recordStartOt.getRelativeTS()
      const newOT = ElicastOT.makeOTFromCMSelection(cm, ts)

      // Disable ElicastSelection
      // this.pushRecordOt(newOT)
    },
    handleEditorMousedown (event) {
      if (this.playMode === PlayMode.PLAYBACK) {
        this.togglePlayMode()
      }
    },
    handleSliderChange (val, isMouseDown) {
      this.handleSliderChangeLog(val, isMouseDown)

      if (isMouseDown) {
        this.transitionMode('SLIDER_MOUSEDOWN')
        this.ts = val
      }
    },
    handleSliderChangeLog: _.debounce(function (val, isMouseDown) {
      this.logger.submit('handle-slider-change', {
        'id': this.elicastId,
        'playMode': this.playMode,
        'val': val,
        'isMouseDown': isMouseDown
      })
    }, 100),
    handleSliderStartSelection (selectFrom) {
      if (this.playMode === PlayMode.PAUSE) {
        this.transitionMode('TIMELINE_SELECT_START')
        return
      } else if (this.playMode === PlayMode.TIMELINE_SELECT) {
        return
      }

      this.$refs.slider.dropSelection()
    },
    handleTimelineSelectionStart () {
      this.logger.submit('timeline-selection-start', {
        'id': this.elicastId,
        'ts': this.ts
      })
      this.$refs.slider.startSelection()
      this.transitionMode('TIMELINE_SELECT_START')
    },
    handleTimelineSelectionFinish () {
      [this.historySelection.fromTs, this.historySelection.toTs] =
        this.$refs.slider.holdSelection()

      this.logger.submit('timeline-selection-finish', {
        'id': this.elicastId,
        'ts': this.ts,
        'historySelection': this.historySelection
      })

      this.ts = this.historySelection.fromTs
      _.defer(() => this.transitionMode('TIMELINE_SELECT_FINISH'))
    },
    handleTimelineSelectionCancel () {
      this.logger.submit('timeline-selection-cancel', {
        'id': this.elicastId,
        'ts': this.ts
      })
      this.$refs.slider.dropSelection()
      this.transitionMode('TIMELINE_SELECT_CANCEL')
    },
    recordTick () {
      this.ts = this.recordStartOt.getRelativeTS()

      if (this.playMode === PlayMode.RECORD_PAST) {
        if (this.ts > this.historySelection.toTs) {
          this.$refs.slider.adjustSelection(this.ts)
          this.maxTs = this.ots[this.ots.length - 1].ts + this.ts - this.historySelection.toTs
        }
      }
    },
    playbackTick () {
      let nextTs = this.playbackStartTs + Date.now() - this.playbackStartTime
      if (nextTs > this.maxTs) {
        nextTs = this.maxTs
      }
      this.ts = nextTs
    },
    cursorBlinkTick () {
      this.cursorBlinkTimer = setTimeout(() => {
        this.toggleCursorBlink()
        this.cursorBlinkTick()
      }, CURSOR_BLINK_RATE)
    },
    forceCursorBlink () {
      this.toggleCursorBlink(true)
      clearTimeout(this.cursorBlinkTimer)
      this.cursorBlinkTick()
    },
    toggleCursorBlink (forceShow) {
      const cmCursor = this.$el.querySelector('.CodeMirror-cursors')
      if (cmCursor === null) return

      if (this.playMode === PlayMode.PLAYBACK) {
        if (forceShow || cmCursor.className.indexOf('cursor-hide') >= 0) {
          cmCursor.classList.add('cursor-show')
          cmCursor.classList.remove('cursor-hide')
        } else {
          cmCursor.classList.remove('cursor-show')
          cmCursor.classList.add('cursor-hide')
        }
      } else {
        if (cmCursor.className.indexOf('cursor-show') >= 0) {
          cmCursor.classList.remove('cursor-show')
        }
        if (forceShow || cmCursor.className.indexOf('cursor-hide') >= 0) {
          cmCursor.classList.remove('cursor-hide')
        } else {
          cmCursor.classList.add('cursor-hide')
        }
      }
    },
    transitionMode (type) {
      switch (type) {
        case 'MAX_TS':
          if (this.playMode === PlayMode.TIMELINE_SELECT) break
          if (this.playMode === PlayMode.PLAYBACK &&
            this.prevPlayMode === PlayMode.TIMELINE_SELECT) {
            this.playMode = PlayMode.TIMELINE_SELECT
          } else {
            this.playMode = PlayMode.STANDBY
          }
          break
        case 'SLIDER_MOUSEDOWN':
          if (this.playMode === PlayMode.TIMELINE_SELECT) break
          this.playMode = PlayMode.PAUSE
          break
        case 'TIMELINE_SELECT_START':
          this.playMode = PlayMode.TIMELINE_SELECT
          break
        case 'TIMELINE_SELECT_FINISH':
          this.playMode = PlayMode.RECORD_PAST
          break
        case 'TIMELINE_SELECT_CANCEL':
          this.playMode = PlayMode.PAUSE
          break
        default:
          throw new Error('Invalid transition type')
      }
    },
    togglePlayMode () {
      if (!this.playModeReady) return

      this.logger.submit('toggle-play-mode', {
        'id': this.elicastId,
        'playMode': this.playMode,
        'ts': this.ts
      })

      const toggleState = {
        [PlayMode.PLAYBACK]: this.prevPlayMode,
        [PlayMode.PAUSE]: PlayMode.PLAYBACK,
        [PlayMode.TIMELINE_SELECT]: PlayMode.PLAYBACK,
        [PlayMode.STANDBY]: PlayMode.RECORD,
        [PlayMode.RECORD]: PlayMode.STANDBY,
        [PlayMode.RECORD_PAST]: PlayMode.PAUSE
      }
      this.playMode = toggleState[this.playMode]
      this.playModeReady = false

      if (!this.playMode) {
        throw new Error('toggleState transitioned to invalid playMode')
      }

      _.defer(this.$refs.slider.layout)
    }
  },

  components: {
    codemirror,
    Slider,
    RunOutputView,
    Toast,
    ConflictResolver
  }
}
