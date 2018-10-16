<template>
  <div class="modal"
       tabindex="-1"
       role="dialog"
       aria-hidden="true">
    <div class="modal-dialog modal-xlg" role="document" @click.stop>
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Conflict Resolver</h5>
        </div>
        <div class="modal-body marker-overlay" @mousedown="handleMarkerMousedown">
          <div class="container-fluid">
            <div class="row original-editor">
              <div class="col editor-wrap">
                <h6>Original Before</h6>
                <codemirror ref="cmOrigBefore"
                            :options="editorOptions">
                </codemirror>
              </div>
              <div class="col editor-wrap">
                <h6>Original After</h6>
                <codemirror ref="cmOrigAfter"
                            :options="editorOptions">
                </codemirror>
              </div>
            </div>
            <div class="row">
              <div class="col editor-wrap">
                <h6>Current Frame</h6>
                <codemirror ref="cmBefore"
                            @scroll="handleCodeMirrorScroll"
                            @refresh="handleCodeMirrorRefresh"
                            :options="editorOptions">
                </codemirror>
              </div>
              <div class="col editor-wrap">
                <h6>Next Frame</h6>
                <codemirror ref="cmAfter"
                            :options="editorOptions">
                </codemirror>
              </div>
            </div>
          </div>
          <div v-if="conflictInfo">
            <Slider ref="otsSlider"
                    class="slider"
                    @change="handleOtsSliderChange"
                    v-bind:min="1"
                    v-bind:max="conflictInfo.ots.length + 1"></Slider>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button"
                  class="btn btn-primary"
                  v-if="conflictInfo"
                  v-bind:disabled="nextOtIdx !== conflictInfo.ots.length + 1"
                  @click="resolve">Resolve</button>
          <button type="button"
                  class="btn btn-secondary"
                  @click="close">{{ resolveOts.length > 0 ? 'Undo' : 'Cancel' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import _ from 'lodash'

import Modal from 'exports-loader?Modal!bootstrap/js/dist/modal'
import Slider from '@/components/Slider'
import { ElicastNop, ElicastSelection, ElicastText } from '@/elicast/elicast-ot-set'
import ElicastOT from '@/elicast/elicast-ot'
import { codemirror } from 'vue-codemirror'
import 'codemirror/addon/selection/mark-selection.js'
import 'codemirror/mode/python/python.js'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/solarized.css'
import jQuery from 'jquery'
import vueSlider from 'vue-slider-component'

const EDITOR_OPTIONS = {
  mode: 'python',
  theme: 'solarized',
  lineNumbers: true,
  lineWrapping: true,
  cursorBlinkRate: 0, // disable default blinker which is not working in no-focus state
  showCursorWhenSelecting: false,
  indentWithTabs: false,
  autofocus: false,
  indentUnit: 4,
  tabSize: 4,
  readOnly: true
}

export default {
  data () {
    return {
      modalInstance: null,
      isInitialized: false,
      isModalShown: false,
      draggingMarker: null,
      cmOrigBefore: null,
      cmOrigAfter: null,
      cmBefore: null,
      cmAfter: null,
      conflictInfo: null,
      currentText: null,
      nextOtIdx: null,
      resolveRange: null,
      resolveOt: null,
      resolveOts: []
    }
  },

  mounted () {
    this.modalInstance = new Modal(this.$el)
    jQuery(this.$el).on('shown.bs.modal', this.handleModalShown)
    jQuery(this.$el).on('hidden.bs.modal', this.handleModalHidden)
    document.addEventListener('keydown', this.handleKeydown)

    this.cmOrigBefore = this.$refs.cmOrigBefore.codemirror
    this.cmOrigAfter = this.$refs.cmOrigAfter.codemirror
    this.cmBefore = this.$refs.cmBefore.codemirror
    this.cmAfter = this.$refs.cmAfter.codemirror
  },

  beforeDestroy () {
    document.removeEventListener('keydown', this.handleKeydown)
    jQuery(this.$el).off('shown.bs.modal')
    jQuery(this.$el).off('hidden.bs.modal')
    if (this.modalInstance !== null) {
      this.modalInstance.dispose()
      this.modalInstance = null
    }
  },

  computed: {
    editorOptions () {
      return EDITOR_OPTIONS
    }
  },

  methods: {
    handleKeydown (e) {
      if (this.isModalShown && e.keyCode === 27) {
        this.close()
      }
    },
    handleModalShown (e) {
      this.isModalShown = true

      this.cmOrigBefore.refresh()
      this.cmOrigAfter.refresh()
      this.highlightOrigCM()

      this.cmBefore.refresh()
      this.cmAfter.refresh()

      const lastOt = this.getAugmentedOt(this.nextOtIdx - 1)
      this.highlightCM(lastOt, this.nextOtIdx - 1)

      if (this.isInitialized) {
        this.$nextTick(() => {
          this.$refs.otsSlider.layout()
          this.$refs.otsSlider.val = this.nextOtIdx
        })
      }
    },
    handleModalHidden (e) {
      this.isInitialized = false
      this.isModalShown = false

      this.resolveOts = []
      this.conflictInfo = null
      this.nextOtIdx = null
      this.resolveRange = null

      const resolveOt = this.resolveOt
      this.resolveOt = null
      this.$emit('resolve', resolveOt)
    },
    handleCodeMirrorScroll (cm) {
      // FIXME: `updateResolveRange`가 불린 이후 마우스 커서 위치를 바꾸지 않고 안 쉬고  계속 스크롤
      //        할 경우 scroll 이벤트가 안 오는 문제가 있음. DOM이 업데이트 되서 그런가?
      this.updateResolveRange()
    },
    handleCodeMirrorRefresh (cm) {
      this.updateResolveRange()
    },
    handleOtsSliderChange (val, isMouseDown) {
      this.nextOtIdx = val
    },
    handleMarkerMousedown (e) {
      if (!e.target.classList.contains('pos-marker')) return false

      if (e.which === 1 || e.buttons === 1) {
        e.preventDefault()

        this.draggingMarker = {
          markerElement: jQuery(e.target),
          markerInitialOffset: jQuery(e.target).offset(),
          mouseInitialOffset: { left: e.pageX, top: e.pageY }
        }

        jQuery('.marker-overlay').append(
          jQuery('<div></div>')
            .addClass('drag-helper')
        )

        this.handleDocumentMousemove(e) // to calcualte the position of `drag-helper`

        document.addEventListener('mousemove', this.handleDocumentMousemove)
        document.addEventListener('mouseup', this.handleDocumentMouseup)
      }
      return false
    },
    handleDocumentMousemove (e) {
      if (this.draggingMarker) {
        e.preventDefault()

        const markerMargin = 8 // Shoue be equal to `.marker-overlay $markerMargin`
        const lineHeight = this.cmBefore.defaultTextHeight()

        const editorOverlay = jQuery('.marker-overlay')
        const markerElement = this.draggingMarker.markerElement
        const markerInitialOffset = this.draggingMarker.markerInitialOffset
        const mouseInitialOffset = this.draggingMarker.mouseInitialOffset

        const isFromPosMarker = markerElement.hasClass('from-pos-marker')

        const offsetX = e.pageX
        const offsetY = e.pageY + (markerInitialOffset.top - mouseInitialOffset.top) +
          (isFromPosMarker ? 1 : -1) * (markerMargin + lineHeight / 2) +
          (isFromPosMarker ? markerElement.outerHeight() : 0)

        jQuery('.marker-overlay .drag-helper').css(
          {
            left: (offsetX - editorOverlay.offset().left) + 'px',
            top: (offsetY - editorOverlay.offset().top) + 'px'
          })

        const beforeContent = this.cmBefore.doc.getValue()
        const charPos = ElicastOT.lineChToPos(
          beforeContent, this.cmBefore.coordsChar({ left: offsetX, top: offsetY }))

        if (isFromPosMarker) {
          const fromPosRange = this.conflictInfo.fromPosRange
          const correctPos = Math.min(this.resolveRange[1],
            Math.max(fromPosRange.from, Math.min(fromPosRange.to, charPos)))
          if (this.resolveRange[0] !== correctPos) {
            this.resolveRange = [correctPos, this.resolveRange[1]]
          }
        } else {
          const toPosRange = this.conflictInfo.toPosRange
          const correctPos = Math.max(this.resolveRange[0],
            Math.max(toPosRange.from, Math.min(toPosRange.to, charPos)))
          if (this.resolveRange[1] !== correctPos) {
            this.resolveRange = [this.resolveRange[0], correctPos]
          }
        }
      }

      return false
    },
    handleDocumentMouseup (e) {
      if (this.draggingMarker) {
        this.draggingMarker = null

        jQuery('.marker-overlay .drag-helper').remove()

        document.removeEventListener('mousemove', this.handleDocumentMousemove)
        document.removeEventListener('mouseup', this.handleDocumentMouseup)
      }

      return false
    },

    close () {
      if (this.modalInstance !== null) {
        this.modalInstance.hide()
      }
    },
    open (otInsertConflict, resolveOts) {
      if (this.modalInstance === null) return

      this.conflictInfo = otInsertConflict
      this.resolveOts = resolveOts
      this.currentText = ElicastOT.buildText(otInsertConflict.ots)

      const originalOts = otInsertConflict.originalOts
      const originalOt = originalOts[originalOts.length - 1]
      this.cmOrigBefore.setValue(ElicastOT.buildText(
        originalOts.slice(0, originalOts.length - 1)))
      this.cmOrigAfter.setValue(ElicastOT.buildText(originalOts))

      this.cmBefore.doc.setValue('')
      this.cmAfter.doc.setValue('')
      this.resolveRange = [otInsertConflict.fromPosRange.from, otInsertConflict.toPosRange.to]

      if (otInsertConflict.otType === ElicastText) {
        const originalPrevOt = originalOts[originalOts.length - 2] || null

        if (originalPrevOt !== null &&
          originalPrevOt instanceof ElicastText &&
          originalPrevOt.fromPos === originalPrevOt.toPos &&
          originalOt.fromPos === originalOt.toPos &&
          originalPrevOt.fromPos + 1 === originalOt.fromPos) {
          // place successive insert OT next of successive insertions
          this.resolveRange = [otInsertConflict.fromPosRange.from, otInsertConflict.toPosRange.from]
        } else if (originalOt.fromPos === originalOt.toPos) {
          // place insert OT at the last position by default
          this.resolveRange = [otInsertConflict.fromPosRange.to, otInsertConflict.toPosRange.to]
        }
      }

      this.nextOtIdx = otInsertConflict.ots.length + 1

      this.isInitialized = true
      this.modalInstance.show()
    },
    openPromise (otInsertConflict, resolveOts) {
      this.open(otInsertConflict, resolveOts)
      return new Promise(resolve => this.$on('resolve', resolve))
    },
    resolve () {
      const resolveOt = this.buildPossibleOt(...this.resolveRange)
      this.resolveOt = resolveOt
      this.close()
    },

    getAugmentedOt (idx) {
      const ots = this.conflictInfo.ots
      if (ots.length <= idx) {
        return this.buildPossibleOt(...this.resolveRange)
      } else if (idx < 0) {
        return new ElicastNop(0)
      } else {
        return ots[idx]
      }
    },
    buildPossibleOt (fromPos, toPos) {
      const otData = this.conflictInfo.otData
      switch (this.conflictInfo.otType) {
        case ElicastSelection:
          return new ElicastSelection(otData.ts, fromPos, toPos)
        case ElicastText:
          const removedText = this.currentText.substring(fromPos, toPos)
          return new ElicastText(otData.ts, fromPos, toPos, otData.insertedText, removedText)
      }
    },
    drawResolveRange (range, markerPos, classPrefix, label) {
      const beforeContent = this.cmBefore.doc.getValue()

      const rangeLineCh = _.mapValues(
        range, pos => ElicastOT.posToLineCh(beforeContent, pos))

      if (rangeLineCh.from !== rangeLineCh.to) {
        // draw range
        this.cmBefore.doc.markText(rangeLineCh.from, rangeLineCh.to, {
          className: classPrefix + '-block'
        })
      }

      const editorOverlay = jQuery('.marker-overlay')
      const editorElement = jQuery(this.$refs.cmBefore.$el)
      const charPosition = this.cmBefore.charCoords(
        ElicastOT.posToLineCh(beforeContent, markerPos))

      // check whether current (line, pos) is visible
      if (charPosition.bottom < editorElement.offset().top ||
        editorElement.offset().top + editorElement.outerHeight() < charPosition.top) {
        editorOverlay.find('.' + classPrefix + '-marker').remove()
        return
      }

      // draw marker
      const markerOffsetX = charPosition.left - editorOverlay.offset().left
      const markerOffsetY =
        (classPrefix === 'from-pos' ? charPosition.top : charPosition.bottom) -
        editorOverlay.offset().top

      const markerElement = editorOverlay.find('.' + classPrefix + '-marker')
      if (markerElement.length === 0) {
        jQuery('.marker-overlay').append(
          jQuery('<div></div>')
            .addClass('pos-marker')
            .addClass(classPrefix + '-marker')
            .css({ left: markerOffsetX + 'px', top: markerOffsetY + 'px' })
            .html(label)
        )
      } else {
        markerElement.css({ left: markerOffsetX + 'px', top: markerOffsetY + 'px' })
      }
    },

    highlightOrigCM () {
      if (!this.isModalShown) return

      this.cmOrigBefore.getAllMarks().forEach(mark => mark.clear())
      this.cmOrigAfter.getAllMarks().forEach(mark => mark.clear())

      const originalOts = this.conflictInfo.originalOts
      const originalOt = originalOts[originalOts.length - 1]

      if (originalOt.removedText !== '') {
        const beforeContent = this.cmOrigBefore.doc.getValue()
        const fromLineCh = ElicastOT.posToLineCh(beforeContent, originalOt.fromPos)
        const toLineCh = ElicastOT.posToLineCh(beforeContent, originalOt.getBeforeToPos())
        this.cmOrigBefore.doc.markText(fromLineCh, toLineCh, { className: 'removed-text-block' })
      }
      if (originalOt.insertedText !== '') {
        const afterContent = this.cmOrigAfter.doc.getValue()
        const fromLineCh = ElicastOT.posToLineCh(afterContent, originalOt.fromPos)
        const toLineCh = ElicastOT.posToLineCh(afterContent, originalOt.getAfterToPos())
        this.cmOrigAfter.doc.markText(fromLineCh, toLineCh, { className: 'inserted-text-block' })
      }

      this.cmOrigBefore.setCursor(
        ElicastOT.posToLineCh(this.cmOrigBefore.getValue(), originalOt.fromPos))
      this.cmOrigAfter.setCursor(
        ElicastOT.posToLineCh(this.cmOrigAfter.getValue(), originalOt.fromPos))
    },
    highlightCM (lastOt, otIdx) {
      if (!this.isModalShown) return

      this.cmBefore.getAllMarks().forEach(mark => mark.clear())
      this.cmAfter.getAllMarks().forEach(mark => mark.clear())

      if (lastOt instanceof ElicastText) {
        // highlight `removedText` and `insertedText` of `lastOt`
        if (lastOt.removedText !== '') {
          const beforeContent = this.cmBefore.doc.getValue()
          const fromLineCh = ElicastOT.posToLineCh(beforeContent, lastOt.fromPos)
          const toLineCh = ElicastOT.posToLineCh(beforeContent, lastOt.getBeforeToPos())
          this.cmBefore.doc.markText(fromLineCh, toLineCh, { className: 'removed-text-block' })
        }
        if (lastOt.insertedText !== '') {
          const afterContent = this.cmAfter.doc.getValue()
          const fromLineCh = ElicastOT.posToLineCh(afterContent, lastOt.fromPos)
          const toLineCh = ElicastOT.posToLineCh(afterContent, lastOt.getAfterToPos())
          this.cmAfter.doc.markText(fromLineCh, toLineCh, { className: 'inserted-text-block' })
        }
      }

      if (otIdx === this.conflictInfo.ots.length) {
        // display `fromPosRange` and `toPosRange` with marker
        this.drawResolveRange(
          this.conflictInfo.fromPosRange, this.resolveRange[0], 'from-pos', 'from')
        this.drawResolveRange(
          this.conflictInfo.toPosRange, this.resolveRange[1], 'to-pos', 'to')
      } else {
        const editorOverlay = jQuery('.marker-overlay')
        editorOverlay.find('.pos-marker').remove()
      }
    },
    updateResolveRange: _.debounce(function () {
      if (this.conflictInfo === null ||
        this.conflictInfo.ots.length + 1 !== this.nextOtIdx) {
        return
      }

      this.drawResolveRange(
        this.conflictInfo.fromPosRange, this.resolveRange[0], 'from-pos', 'from')
      this.drawResolveRange(
        this.conflictInfo.toPosRange, this.resolveRange[1], 'to-pos', 'to')
    }, 50)
  },

  watch: {
    nextOtIdx (currIdx, prevIdx) {
      if (!this.isInitialized) return

      if (prevIdx === null) {
        prevIdx = 0
      }

      // TODO : ot index based -> ts based

      const isBigJump = Math.abs(currIdx - prevIdx) > 10

      if (isBigJump) {
        const targetBeforeOts = this.conflictInfo.ots.slice(0, currIdx)
        const targetAfterOts = targetBeforeOts.slice()
        targetAfterOts.push(this.getAugmentedOt(currIdx))

        this.cmBefore.setValue(ElicastOT.buildText(targetBeforeOts))
        this.cmAfter.setValue(ElicastOT.buildText(targetAfterOts))

        const lastBeforeTextOt = ElicastOT.getLastOtForOtType(targetBeforeOts, ElicastText)
        if (lastBeforeTextOt) {
          ElicastOT.revertOtToCM(this.cmBefore, lastBeforeTextOt)
          ElicastOT.applyOtToCM(this.cmBefore, lastBeforeTextOt)
        }

        const lastAfterTextOt = ElicastOT.getLastOtForOtType(targetAfterOts, ElicastText)
        if (lastAfterTextOt) {
          ElicastOT.revertOtToCM(this.cmAfter, lastAfterTextOt)
          ElicastOT.applyOtToCM(this.cmAfter, lastAfterTextOt)
        }
      }

      if (!isBigJump) {
        for (let i = prevIdx; i < currIdx; i++) {
          if (!isBigJump) {
            ElicastOT.applyOtToCM(this.cmBefore, this.getAugmentedOt(i - 1))
            ElicastOT.applyOtToCM(this.cmAfter, this.getAugmentedOt(i))
          }
        }

        for (let i = prevIdx - 1; i >= currIdx; i--) {
          ElicastOT.revertOtToCM(this.cmBefore, this.getAugmentedOt(i - 1))
          ElicastOT.revertOtToCM(this.cmAfter, this.getAugmentedOt(i))
        }
      }

      const lastOt = this.getAugmentedOt(currIdx - 1)
      this.highlightCM(lastOt, currIdx - 1)
    },
    resolveRange (currRange, prevRange) {
      if (!this.isInitialized || prevRange === null) return

      const oldOt = this.buildPossibleOt(...prevRange)
      const newOt = this.buildPossibleOt(...currRange)

      ElicastOT.revertOtToCM(this.cmAfter, oldOt)
      ElicastOT.applyOtToCM(this.cmAfter, newOt)
      this.highlightCM(newOt, this.conflictInfo.ots.length)
    }
  },

  components: {
    codemirror,
    Slider,
    vueSlider
  }
}
</script>

<style lang="scss">
.modal-xlg {
  max-width: 90% !important;
}

.modal-footer button {
  cursor: pointer;
}

.editor-wrap {
  overflow-x: hidden;
}

.original-editor .CodeMirror {
    max-height: 250px;
}

$fromPosColor: rgba(0, 0, 255, 0.6);
$toPosColor: rgba(255, 0, 0, 0.6);

.marker-overlay {
  $markerMargin: 8px;
  $markerArrowSpace: 0px;
  $markerSize: $markerMargin - $markerArrowSpace;

  position: relative;

  .pos-marker {
    cursor: pointer;
    z-index: 3;
    position: absolute;
    color: white;
    padding: 6px;
    font-size: 16px;
    line-height: 16px;
    user-select: none;
  }

  .from-pos-marker {
    background-color: $fromPosColor;
    transform: translate(-50%, calc(-100% - #{$markerMargin}));

    &::after {
      border-top: $markerSize solid $fromPosColor;
      border-left: calc(#{$markerSize} * 2 / 3) solid transparent;
      border-right: calc(#{$markerSize} * 2 / 3) solid transparent;
      position: absolute;
      bottom: 0px;
      left: 50%;
      transform: translate(-50%, 100%);
      content: "";
    }
  }
  .to-pos-marker {
    background-color: $toPosColor;
    transform: translate(-50%, $markerMargin);

    &::after {
      border-bottom: $markerSize solid $toPosColor;
      border-left: calc(#{$markerSize} * 2 / 3) solid transparent;
      border-right: calc(#{$markerSize} * 2 / 3) solid transparent;
      position: absolute;
      top: 0px;
      left: 50%;
      transform: translate(-50%, -100%);
      content: "";
    }
  }

  .drag-helper {
    position: absolute;
    z-index: 5;
    width: 5px;
    height: 5px;
    background-color: black;
    transform: translate(-3px, -3px);
    animation: blinker 0.5s linear infinite;
  }

  @keyframes blinker {
    50% {
      opacity: 0.3;
    }
  }
}

.CodeMirror {
  .CodeMirror-line::after {
    pointer-events: none;
    color: #e0e0e0;
    content: "¬";
  }

  .removed-text-block {
    // padding: 0.2em 0;
    background-color: rgba(241, 143, 143, 0.4);
  }
  .inserted-text-block {
    // padding: 0.2em 0;
    background-color: rgba(163, 235, 169, 0.4);
  }
  .non-ambiguous-block {
    // padding: 0.2em 0;
    background-color: rgba(75, 75, 75, 0.4);
  }

  .from-pos-block {
    position: relative;
    box-shadow: 0px -2px $fromPosColor;
  }
  .to-pos-block {
    position: relative;
    box-shadow: 0px 2px $toPosColor;
  }
  .from-pos-block.to-pos-block {
    position: relative;
    box-shadow: 0px -2px $fromPosColor, 0px 2px $toPosColor;
  }
}
</style>
