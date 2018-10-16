import _ from 'lodash'

import AmbiguousAreaSet from './ambiguous-area-set'

export default class AmbiguousAreaSetCouple {

  constructor (insertOts = []) {
    this.original = AmbiguousAreaSet.fromOts(insertOts.map(ot => ot.inverse()).reverse())
    this.current = AmbiguousAreaSet.fromOts(insertOts)
  }

  /**
   * Update coupled area sets by applying `ot` to original area set
   * and `newOt` to current area set.
   * @param  {ElicastText} origOt    OT based on original text
   * @param  {ElicastText} currOt    OT based on current text
   */
  insert (origOt, currOt) {
    this.original.forceRemove(origOt.fromPos, origOt.getBeforeToPos())
    this.original.insert(AmbiguousAreaSet.NOP, origOt.fromPos, origOt.getAfterToPos())

    this.current.forceRemove(currOt.fromPos, currOt.getBeforeToPos())
    this.current.insert(AmbiguousAreaSet.NOP, currOt.fromPos, currOt.getAfterToPos())

    // Remove areas which are empty in both original and current text
    const [newOriginal, newCurrent] = _.unzip(
      _.zip(this.original.toArray(), this.current.toArray())
        .filter(([origArea, currArea]) => origArea.length() !== 0 || currArea.length() !== 0)
    ).map(areas => new AmbiguousAreaSet(areas))

    this.original = newOriginal || new AmbiguousAreaSet()
    this.current = newCurrent || new AmbiguousAreaSet()

    return this
  }

  /**
   * [resolveAmbiguity description]
   * @param  {[type]} fromPos [description]
   * @param  {[type]} toPos   [description]
   * @return {[type]}         [description]
   */
  getPossibleResolveOtRange (fromPos, toPos) {
    // Case 1. non-conflict OT의 shift
    // => non-ambiguous character 가 original과 current에 동일하게 존재하므로 이걸 기준으로 알아낼 수 있음
    //   => fromPos += sum((currAreas[i].length - origAreas[i].length), i는 ot 이전 origArea들의 index)
    //   => toPos += sum((currAreas[i].length - origAreas[i].length), i는 ot 이전 origArea들의 index)

    // Case 2. conflict OT의 possible OTs
    // => OT의 각각의 fromPos, toPos에 대해
    //   => 어떤 origArea와 겹칠 (inclusive) 경우 corresponding currArea에서 임의의 값이 될 수 있음 (Example 1,2,3)
    //   => 그 외의 경우
    //     => 만약 fromPos는 conflict이 없고, toPos만 conflict이 있을 경우 fromPos는 shift, toPos는 area 임의의 값 (Example 4)
    //     => 위의 반대도 마찬가지
    //     => [fromPos, toPos]가 origArea 를 완전히 (exclusive) 포함하여 conflict이 발생한 경우 fromPos, toPos 모두 shift만 함 (Example 5)

    let possibleFromPosRange = { from: fromPos, to: fromPos }
    let possibleToPosRange = { from: toPos, to: toPos }

    _.zip(this.original.toArray(), this.current.toArray())
      .forEach(([originalArea, currentArea]) => {
        const lengthDelta = currentArea.length() - originalArea.length()

        if (originalArea.toPos < fromPos) {
          // shift `ot`
          possibleFromPosRange.from += lengthDelta
          possibleFromPosRange.to += lengthDelta
          possibleToPosRange.from += lengthDelta
          possibleToPosRange.to += lengthDelta
        } else if (toPos < originalArea.fromPos) {
          // no more influence
          return
        } else {
          if (originalArea.fromPos <= fromPos && toPos <= originalArea.toPos) {
            // `originalArea` includes `ot`
            possibleFromPosRange = { from: currentArea.fromPos, to: currentArea.toPos }
            possibleToPosRange = { from: currentArea.fromPos, to: currentArea.toPos }
            return
          } else if (fromPos < originalArea.fromPos && originalArea.toPos < toPos) {
            // `ot` includes `originalArea` => only `toPos` shifts
            possibleToPosRange.from += lengthDelta
            possibleToPosRange.to += lengthDelta
          } else {
            if (originalArea.fromPos <= fromPos && fromPos <= originalArea.toPos) {
              // ambiguity on `fromPos` => any value in `currentArea`
              possibleFromPosRange = { from: currentArea.fromPos, to: currentArea.toPos }
            }

            if (originalArea.fromPos <= toPos && toPos <= originalArea.toPos) {
              // ambiguity on `toPos` => any value in `currentArea`
              possibleToPosRange = { from: currentArea.fromPos, to: currentArea.toPos }
            } else {
              // ambiguity only on `fromPos`, thus shift `toPos`
              possibleToPosRange.from += lengthDelta
              possibleToPosRange.to += lengthDelta
            }
          }
        }
      }
      )

    return [possibleFromPosRange, possibleToPosRange]
  }
}
