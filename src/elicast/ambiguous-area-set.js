import { OTAreaType, OTAreaSet } from './ot-area'
import { ElicastText } from './elicast-ot-set'

export default class AmbiguousAreaSet extends OTAreaSet {
  static NOP = 'nop'
  static AMBIGUOUS = 'ambiguous'

  constructor (areas) {
    super([
      new OTAreaType(AmbiguousAreaSet.NOP, true, true),
      new OTAreaType(AmbiguousAreaSet.AMBIGUOUS, true, false)
    ], areas)
  }

  static fromOts (ots) {
    const newInstance = new AmbiguousAreaSet()
    ots.filter(ot => ot instanceof ElicastText)
      .forEach(ot => {
        newInstance.forceRemove(ot.fromPos, ot.getBeforeToPos())
        // Use `super.insert` not to clean NOP area every time
        OTAreaSet.prototype.insert.call(newInstance, AmbiguousAreaSet.AMBIGUOUS, ot.fromPos, ot.getAfterToPos(), true)
      })
    return newInstance
  }

  clone () {
    const cloned = new AmbiguousAreaSet()
    cloned.areas = this.areas.map(area => area.clone())
    return cloned
  }

  insert (typeName, fromPos, toPos) {
    super.insert(typeName, fromPos, toPos, true)
    this.areas = this.areas.filter(area => area.type !== AmbiguousAreaSet.NOP)
    return this
  }

  findAmbiguityAreas (fromPos, toPos) {
    return this.areas.filter(area =>
      area.type === AmbiguousAreaSet.AMBIGUOUS &&
      area.isOverlapInclusive(fromPos, toPos)
    )
  }
}
