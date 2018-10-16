import _ from 'lodash'

import OTArea from './ot-area'
import ElicastOTAreaSet from './elicast-ot-area-set'
import { ElicastSelection, ElicastText, ElicastExercise, ElicastAssert } from './elicast-ot-set'
import AmbiguousAreaSetCouple from './ambiguous-area-set-couple'

export default class ElicastOT {
}

/*  This function convert position in `content` to line/ch
 *
 *  Args
 *    - content (string)
 *    - pos (number) -- 0-based position in `content`
 *
 *  Return := { line, ch } object
 *
 */
function posToLineCh (content, pos) {
  let curLine = 0
  let curCh = pos

  const lineSep = /\r\n?|\n/g
  for (curLine = 0; lineSep.exec(content) !== null; curLine++) {
    if (pos < lineSep.lastIndex) {
      break
    }
    curCh = pos - lineSep.lastIndex
  }

  return {
    line: curLine,
    ch: curCh
  }
}

ElicastOT.posToLineCh = posToLineCh

/*  This function convert line/ch in `content` to 0-based position
 *
 *  Args
 *    - content (string)
 *    - lineCh (object) -- line/ch in `content`
 *
 *  Return := number
 *
 */
function lineChToPos (content, lineCh) {
  const lineSep = /\r\n?|\n/g
  for (let i = 0; i < lineCh.line; i++) {
    lineSep.exec(content)
  }
  return lineSep.lastIndex + lineCh.ch
}

ElicastOT.lineChToPos = lineChToPos

function isAreaConflict (area, fromPos, toPos) {
  return !(toPos <= area.fromPos || area.toPos <= fromPos)
}

function getAreas (ots, areaType = ElicastOTAreaSet.TEXT) {
  const areaSet = new ElicastOTAreaSet()

  for (let i = 0; i < ots.length; i++) {
    const ot = ots[i]
    switch (ot.constructor) {
      case ElicastText:
        if (ot.removedText.length > 0) {
          areaSet.remove(areaType, ot.fromPos, ot.fromPos + ot.removedText.length)
        }
        if (ot.insertedText.length > 0) {
          areaSet.insert(areaType, ot.fromPos, ot.fromPos + ot.insertedText.length, true)
        }
        break
      case ElicastExercise:
        let exerciseEndIndex = ots.findIndex((ot, idx) => idx > i && ot instanceof ElicastExercise)
        exerciseEndIndex = exerciseEndIndex < 0 ? ots.length : exerciseEndIndex
        const exerciseAreas = getAreas(ots.slice(i + 1, exerciseEndIndex), ElicastOTAreaSet.EXERCISE_BUILD)
        i = exerciseEndIndex

        if (exerciseAreas.length === 0) break
        if (exerciseAreas.length !== 1) {
          throw new Error('Solution OT must be a single area')
        }

        const exerciseArea = exerciseAreas[0]
        areaSet.insert(ElicastOTAreaSet.EXERCISE, exerciseArea.fromPos, exerciseArea.toPos, false)

        break
      case ElicastAssert:
        let assertEndIndex = ots.findIndex((ot, idx) => idx > i && ot instanceof ElicastAssert)
        assertEndIndex = assertEndIndex < 0 ? ots.length : assertEndIndex
        const assertAreas = getAreas(ots.slice(i + 1, assertEndIndex), ElicastOTAreaSet.ASSERT_BUILD)
        i = assertEndIndex

        if (assertAreas.length === 0) break

        assertAreas.forEach(area => {
          areaSet.insert(ElicastOTAreaSet.ASSERT, area.fromPos, area.toPos, false)
        })
        break
    }
  }

  return areaSet.toArray()
}

/**
 * Get the last OT whose type is `otType` and ts is less or equal than given `ts` in `ots`.
 *
 * @param  {ElicastOT[]} ots           sorted array of OTs
 * @param  {object}      otType        type reference (class constructor) of an OT type
 * @param  {Number}      [ts=Infinity] ts to look left (optional)
 * @return {ElicastOT}                 found OT
 */
ElicastOT.getLastOtForOtType = function (ots, otType, ts = Infinity) {
  return _.findLast(ots, ot => ot.ts <= ts && ot.constructor === otType)
}

ElicastOT.buildText = function (ots) {
  let result = ''
  for (const ot of ots) {
    if (!(ot instanceof ElicastText)) continue
    result = result.substring(0, ot.fromPos) + ot.insertedText + result.substring(ot.toPos)
  }
  return result
}

/*  This function apply given OT to CodeMirror
 *
 *  Args
 *    - cm (CodeMirror) -- The CodeMirror instance
 *    - ot (object) -- Elicast OT
 *
 */
ElicastOT.applyOtToCM = function (cm, ot) {
  const cmContent = cm.doc.getValue()

  switch (ot.constructor) {
    case ElicastSelection: {
      // temporally ignore ElicastSelection
      // if (cmContent.length < ot.fromPos || cmContent.length < ot.toPos) {
      //   throw new Error(['The selection is out of range',
      //     cmContent.length, ot.fromPos, ot.toPos].join(' '))
      // }

      // const fromLineCh = posToLineCh(cmContent, ot.fromPos)
      // const toLineCh = posToLineCh(cmContent, ot.toPos)
      // cm.doc.setSelection(fromLineCh, toLineCh)
      break
    }
    case ElicastText: {
      if (cmContent.substring(ot.fromPos, ot.toPos) !== ot.removedText) {
        throw new Error('The removed text is not matched')
      }

      const fromLineCh = posToLineCh(cmContent, ot.fromPos)
      const beforeToLineCh = posToLineCh(cmContent, ot.getBeforeToPos())
      cm.doc.replaceRange(ot.insertedText, fromLineCh, beforeToLineCh)

      const afterToLineCh = posToLineCh(cm.doc.getValue(), ot.getAfterToPos())
      cm.setCursor(afterToLineCh)
      break
    }
  }
}

ElicastOT.revertOtToCM = function (cm, ot) {
  const cmContent = cm.doc.getValue()

  switch (ot.constructor) {
    case ElicastText: {
      if (cmContent.substring(ot.fromPos, ot.fromPos + ot.insertedText.length) !== ot.insertedText) {
        throw new Error('The removed text is not matched')
      }

      const fromLineCh = posToLineCh(cmContent, ot.fromPos)
      const toLineCh = posToLineCh(cmContent, ot.fromPos + ot.insertedText.length)

      cm.doc.replaceRange(ot.removedText, fromLineCh, toLineCh)
      break
    }
  }
}

ElicastOT.redrawExerciseAreas = function (cm, ots) {
  cm.doc.getAllMarks()
    .filter(marker => marker.className === 'exercise-block')
    .forEach(marker => marker.clear())

  const cmContent = cm.doc.getValue()

  getAreas(ots)
    .filter(area => area.type === ElicastOTAreaSet.EXERCISE)
    .forEach(area => {
      const fromLineCh = posToLineCh(cmContent, area.fromPos)
      const toLineCh = posToLineCh(cmContent, area.toPos)
      cm.doc.markText(fromLineCh, toLineCh, { className: 'exercise-block' })
    })
}

ElicastOT.redrawRecordingExerciseArea = function (cm, ots) {
  ElicastOT.clearRecordingExerciseArea(cm)

  const cmContent = cm.doc.getValue()

  const exerciseArea = getAreas(ots).pop()
  if (exerciseArea.type !== ElicastOTAreaSet.EXERCISE) {
    throw new Error('Invalid exercise area')
  }

  const fromLineCh = posToLineCh(cmContent, exerciseArea.fromPos)
  const toLineCh = posToLineCh(cmContent, exerciseArea.toPos)
  cm.doc.markText(fromLineCh, toLineCh, { className: 'recording-exercise-block' })
}

ElicastOT.clearRecordingExerciseArea = function (cm) {
  cm.doc.getAllMarks()
    .filter(marker => marker.className === 'recording-exercise-block')
    .forEach(marker => marker.clear())
}

ElicastOT.redrawSolveExerciseArea = function (cm, solveOts, exerciseFromPos) {
  const CLASS_SOLVE_EXERCISE_BLOCK = 'solve-exercise-block'
  const CLASS_SOLVE_EXERCISE_PLACEHOLDER = 'solve-exercise-placeholder'

  function setPlaceholderBookmark (lineCh) {
    const placeholderElement = document.createElement('span')
    placeholderElement.className = CLASS_SOLVE_EXERCISE_PLACEHOLDER
    placeholderElement.textContent = ' /* Write your answer here */ '
    placeholderElement.onclick = (e) => {
      e.preventDefault()
      cm.focus()
      cm.setSelection(lineCh)
      return true
    }
    cm.doc.setBookmark(lineCh, {
      widget: placeholderElement,
      insertLeft: true
    })
  }

  ElicastOT.clearSolveExerciseArea(cm)

  const cmContent = cm.doc.getValue()

  const areas = getAreas(solveOts)
  if (areas.length === 0) {
    setPlaceholderBookmark(posToLineCh(cmContent, exerciseFromPos))
  } else {
    areas.forEach(area => {
      const fromLineCh = posToLineCh(cmContent, area.fromPos)
      const toLineCh = posToLineCh(cmContent, area.toPos)
      cm.doc.markText(fromLineCh, toLineCh, {
        className: CLASS_SOLVE_EXERCISE_BLOCK
      })
    })
  }
}

ElicastOT.clearSolveExerciseArea = function (cm) {
  cm.doc.getAllMarks()
    .filter(marker =>
      marker.className === 'solve-exercise-block' || marker.type === 'bookmark')
    .forEach(marker => marker.clear())
}

ElicastOT.redrawAssertAreas = function (cm, ots) {
  // FIXME: integrate with ElicastOT.redrawExerciseAreas
  cm.doc.getAllMarks()
    .filter(marker => marker.className === 'assert-block')
    .forEach(marker => marker.clear())
  const cmContent = cm.doc.getValue()

  getAreas(ots)
    .filter(area => area.type === ElicastOTAreaSet.ASSERT)
    .forEach(area => {
      const fromLineCh = posToLineCh(cmContent, area.fromPos)
      const toLineCh = posToLineCh(cmContent, area.toPos)
      cm.doc.markText(fromLineCh, toLineCh, { className: 'assert-block' })
    })
}

ElicastOT.redrawRecordingAssertArea = function (cm, ots) {
  ElicastOT.clearRecordingAssertArea(cm)

  const cmContent = cm.doc.getValue()

  getAreas(ots)
    .filter(area => area.type === ElicastOTAreaSet.ASSERT)
    .forEach(area => {
      const fromLineCh = posToLineCh(cmContent, area.fromPos)
      const toLineCh = posToLineCh(cmContent, area.toPos)
      cm.doc.markText(fromLineCh, toLineCh, { className: 'recording-assert-block' })
    })
}

ElicastOT.clearRecordingAssertArea = function (cm) {
  // FIXME: integrate with ElicastOT.clearRecordingExerciseArea
  cm.doc.getAllMarks()
    .filter(marker => marker.className === 'recording-assert-block')
    .forEach(marker => marker.clear())
}

/*  This function convert CodeMirror's current selection to Elicast
 *  "selection" OT. To only capture the selection changes, call this
 *  function when `CodeMirror.doc.beforeSelectionChange` event is fired.
 *
 *  Args
 *    - cm (CodeMirror) -- The CodeMirror instance
 *    - ts (Number) -- Timestamp
 *
 *  Return := Elicast "selection" OT
 *
 *  Note
 *    - If there are multiple selections, this function only converts
 *      the first selection.
 *
 */
ElicastOT.makeOTFromCMSelection = function (cm, ts) {
  const cmContent = cm.doc.getValue()
  const selectionRange = cm.doc.listSelections()[0]

  const fromPos = lineChToPos(cmContent, selectionRange.anchor)
  const toPos = lineChToPos(cmContent, selectionRange.head)

  return new ElicastSelection(ts, fromPos, toPos)
}

/*  This function convert CodeMirror's selection object
 *  (from `cm.beforeChange` event) to Elicast "text" OT.
 *
 *  Args
 *    - cm (CodeMirror) -- The CodeMirror instance
 *    - changeObj (object) -- The object passed from beforeChange event
 *    - ts (Number) -- Timestamp
 *
 *  Return := Elicast "text" OT
 *
 *  Note
 *    - We use `beforeChange` instead of `change` or `chages` because to convert
 *      line/ch-cordinate to position-cordinate, we need "before changed" content
 *      of the editor.
 */
ElicastOT.makeOTFromCMChange = function (cm, changeObj, ts, exId) {
  const cmContent = cm.doc.getValue()

  const fromPos = lineChToPos(cmContent, changeObj.from)
  const toPos = lineChToPos(cmContent, changeObj.to)
  const insertedText = changeObj.text.join('\n')
  const removedText = cmContent.substring(fromPos, toPos)

  return new ElicastText(ts, fromPos, toPos, insertedText, removedText, exId)
}

ElicastOT.isChangeAllowedForRecord = function (ots, cm, changeObj) {
  const cmContent = cm.doc.getValue()
  const fromPos = lineChToPos(cmContent, changeObj.from)
  const toPos = lineChToPos(cmContent, changeObj.to)

  // Prevent to edit inside of existing exercise areas
  const areas = getAreas(ots)
  for (const area of areas) {
    if (area.type === ElicastOTAreaSet.EXERCISE && isAreaConflict(area, fromPos, toPos)) {
      return false
    }
  }
  return true
}

ElicastOT.isChangeAllowedForRecordExercise = function (ots, recordExerciseSession, cm, changeObj) {
  const cmContent = cm.doc.getValue()
  const fromPos = lineChToPos(cmContent, changeObj.from)
  const toPos = lineChToPos(cmContent, changeObj.to)

  // Only allow current exercise area

  // Exercise cannot be initiated with text removal
  if (!recordExerciseSession.isInitiated() && fromPos !== toPos) {
    return false
  }

  const exOts = recordExerciseSession.getExerciseOTs()
  const areas = getAreas(exOts)

  if (areas.length === 0) {
    // record not initiated yet
    return true
  } else if (areas.length > 1 || areas[0].type !== ElicastOTAreaSet.EXERCISE) {
    throw new Error('Invalid exercise area')
  }

  const exArea = areas[0]
  return exArea.fromPos <= fromPos && toPos <= exArea.toPos
}

ElicastOT.getAllowedRangeForSolveExercise = function (ots, solveExerciseSession) {
  if (!solveExerciseSession.isInitiated()) {
    // first text ot for solve exercise
    const firstExerciseTextOt = solveExerciseSession.getFirstExerciseTextOt()
    return [firstExerciseTextOt.fromPos, firstExerciseTextOt.toPos]
  } else {
    // within solving area
    const areas = getAreas(solveExerciseSession.solveOts, ElicastOTAreaSet.EXERCISE_BUILD)
    if (areas.length !== 1) {
      throw new Error('Invalid solve area')
    }

    const solveArea = areas[0]
    return [solveArea.fromPos, solveArea.toPos]
  }
}

/**
 * confine text change within solve exercise area by updating given changeObj
 *
 * @return {boolean} true if updated, false otherwise
 */
ElicastOT.confineChangeForSolveExercise = function (ots, solveExerciseSession, cm, changeObj) {
  const cmContent = cm.doc.getValue()
  const fromPos = lineChToPos(cmContent, changeObj.from)
  const toPos = lineChToPos(cmContent, changeObj.to)

  const [solveAreaFromPos, solveAreaToPos] =
    ElicastOT.getAllowedRangeForSolveExercise(ots, solveExerciseSession)

  const newFromPos = posToLineCh(cmContent, _.clamp(fromPos, solveAreaFromPos, solveAreaToPos))
  const newToPos = posToLineCh(cmContent, _.clamp(toPos, solveAreaFromPos, solveAreaToPos))

  if (newFromPos === newToPos) {
    return false
  }

  changeObj.update(
    newFromPos,
    newToPos,
  )
  return true
}

ElicastOT.replacePartialOts = function (ots, startIdx, amount, newOts) {
  // only support single area exercise
  const oriOtsArea = getAreas(ots.slice(startIdx, startIdx + amount)).pop()
  const oriOtsAreaLength = oriOtsArea.toPos - oriOtsArea.fromPos

  const newOtsArea = getAreas(newOts).pop() ||
    // if no solve area (solution is empty text), build a mock empty OTArea
    new OTArea(ElicastOTAreaSet.TEXT, oriOtsArea.fromPos, oriOtsArea.fromPos)
  const newOtsAreaLength = newOtsArea.toPos - newOtsArea.fromPos

  const deltaLength = newOtsAreaLength - oriOtsAreaLength

  ots.splice(startIdx, amount, ...newOts)

  for (let i = startIdx + newOts.length; i < ots.length; i++) {
    const ot = ots[i]
    switch (ot.constructor) {
      case ElicastText:
        if (ot.fromPos >= oriOtsArea.toPos) {
          ot.fromPos += deltaLength
          ot.toPos += deltaLength
        } else {
          const areaShiftLength = ot.insertedText.length - ot.removedText.length
          oriOtsArea.fromPos += areaShiftLength
          oriOtsArea.toPos += areaShiftLength
          newOtsArea.fromPos += areaShiftLength
          newOtsArea.toPos += areaShiftLength
        }
        break
      case ElicastSelection:
        if (oriOtsArea.toPos <= ot.fromPos) {
          ot.fromPos += deltaLength
          ot.toPos += deltaLength
        } else if (ot.fromPos <= oriOtsArea.fromPos && oriOtsArea.toPos <= ot.toPos) {
          ot.toPos += deltaLength
        } else if (oriOtsArea.fromPos <= ot.fromPos && ot.fromPos < oriOtsArea.toPos && oriOtsArea.fromPos < ot.toPos) {
          ot.fromPos = newOtsArea.toPos
        } else if (oriOtsArea.fromPos < ot.toPos && ot.toPos <= oriOtsArea.toPos) {
          ot.toPos = newOtsArea.fromPos
        }
        break
    }
  }
}

ElicastOT.getSegments = function (ots) {
  const segmentableTypes = [ElicastExercise, ElicastAssert]

  let currentSegmentType = null
  return ots
    .map(ot => {
      if (segmentableTypes.includes(ot.constructor)) {
        currentSegmentType = !currentSegmentType ? ot.constructor : null
      }
      return { ot, type: currentSegmentType }
    })
    .reduce((segments, { ot, type }) => {
      const lastSegment = segments.length && segments[segments.length - 1]
      if (!lastSegment || lastSegment.type !== type) {
        segments.push({ fromTs: ot.ts, toTs: ot.ts, type })
      } else {
        lastSegment.toTs = ot.ts
      }
      return segments
    }, [])
    .filter(segment => segment.type !== null)
}

// Rule 1: origAreas.length === currAreas.length
//
// Rule 2: Ambiguous area가 아닌 character는 original과 current에서 동일해야 한다!
// Example (from above Example 3)
//   Incorrect : abx[c]d ~ ax[qr]d
//   Correct   : a[b]x[c]d ~ a[]x[qr]d

export class OtInsertSuccess {
  constructor (ots) {
    this.ots = ots
  }
}

export class OtInsertConflict {
  constructor (originalOts, ots, otType, otData, fromPosRange, toPosRange) {
    this.originalOts = originalOts
    this.ots = ots
    this.otType = otType
    this.otData = otData
    this.fromPosRange = fromPosRange
    this.toPosRange = toPosRange
  }
}

/**
 * Insert ots within history
 *
 * @param  {Array} originalOts         [description]
 * @param  {Number} idx                 [description]
 * @param  {Array} insertOts              [description]
 * @param  {Array}  [resolveChoices=[]] [description]
 * @return {[type]}                     [description]
 */
ElicastOT.insertOtsToOts = function (originalOts, idx, insertOts, resolveChoices = []) {
  const remainResolveChoices = resolveChoices.slice()
  const newOts = originalOts.map(ot => ot.clone())
  newOts.splice(idx, 0, ...insertOts)

  const ambiguousCouple = new AmbiguousAreaSetCouple(insertOts)

  let currentText = ElicastOT.buildText(newOts.slice(0, idx + insertOts.length))
  for (let i = idx + insertOts.length; i < newOts.length; i++) {
    const ot = newOts[i].clone()

    switch (ot.constructor) {
      case ElicastSelection: {
        const [fromPosRange, toPosRange] = ambiguousCouple.getPossibleResolveOtRange(ot.fromPos, ot.toPos)

        if (fromPosRange.from === fromPosRange.to && toPosRange.from === toPosRange.to) {
          newOts[i] = new ElicastSelection(ot.ts, fromPosRange.from, toPosRange.from)
        } else {
          const resolveOt = remainResolveChoices.shift()
          if (_.isNil(resolveOt)) {
            return new OtInsertConflict(originalOts.slice(0, i - insertOts.length + 1), newOts.slice(0, i),
              ElicastSelection, { ts: ot.ts }, fromPosRange, toPosRange)
          }
          newOts[i] = resolveOt
        }

        break
      }
      case ElicastText: {
        const [fromPosRange, toPosRange] = ambiguousCouple.getPossibleResolveOtRange(ot.fromPos, ot.toPos)

        if (fromPosRange.from === fromPosRange.to && toPosRange.from === toPosRange.to) {
          const removedText = currentText.substring(fromPosRange.from, toPosRange.from)
          newOts[i] = new ElicastText(ot.ts, fromPosRange.from, toPosRange.from, ot.insertedText, removedText)
        } else {
          const resolveOt = remainResolveChoices.shift()
          if (_.isNil(resolveOt)) {
            return new OtInsertConflict(originalOts.slice(0, i - insertOts.length + 1), newOts.slice(0, i),
              ElicastText, { ts: ot.ts, insertedText: ot.insertedText }, fromPosRange, toPosRange)
          }
          newOts[i] = resolveOt
        }

        ambiguousCouple.insert(ot, newOts[i])

        currentText = currentText.substring(0, newOts[i].fromPos) +
          newOts[i].insertedText +
          currentText.substring(newOts[i].getBeforeToPos())

        break
      }
    }
  }

  return new OtInsertSuccess(newOts)
}

/**
 * Replace a part of history with new OTs
 *
 * @param  {Array} originalOts         [description]
 * @param  {Number} idx                 [description]
 * @param  {Number} count                 [description]
 * @param  {Array} insertOts              [description]
 * @param  {Array}  [resolveChoices=[]] [description]
 * @return {[type]}                     [description]
 */
ElicastOT.replacePartOfHistory = function (originalOts, idx, count, insertOts, resolveChoices = []) {
  const undoOts = originalOts.slice(idx, idx + count)
    .filter(ot => ot instanceof ElicastText)
    .map(ot => ot.inverse())
    .reverse()

  const insertResult = ElicastOT.insertOtsToOts(
    originalOts, idx + count, _.concat(undoOts, insertOts), resolveChoices)

  insertResult.ots.splice(idx, undoOts.length + count)
  return insertResult
}

export class HistoryChar {
  constructor (char, insertedTs) {
    this.char = char
    this.insertedTs = insertedTs
  }

  rip (removedTs) {
    this.removedTs = removedTs
  }

  isTombstone () {
    return this.removedTs !== undefined
  }
}

ElicastOT.generateTombstone = function (ots) {
  ots = ots.filter(ot => ot instanceof ElicastText)

  let doc = []

  for (let ot of ots) {
    let i = 0
    let pos = 0

    while (pos < ot.fromPos) {
      if (!doc[i].isTombstone()) {
        pos++
      }
      i++
    }
    while (pos < ot.toPos) {
      if (!doc[i].isTombstone()) {
        doc[i].rip(ot.ts)
        pos++
      }
      i++
    }

    doc.splice(i, 0, ...ot.insertedText.split('').map(ch => new HistoryChar(ch, ot.ts)))
  }

  return doc
}
