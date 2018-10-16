import OTArea, { OTAreaType, OTAreaSet } from '@/elicast/ot-area'

class TestOTAreaSet extends OTAreaSet {
  static MergeAndRemove = 'merge-remove'
  static MergeAndNoRemove = 'merge'
  static NoMergeAndRemove = 'remove'
  static NoMergeAndNoRemove = '-'

  constructor (areas) {
    super([
      new OTAreaType(TestOTAreaSet.MergeAndRemove, true, true),
      new OTAreaType(TestOTAreaSet.MergeAndNoRemove, true, false),
      new OTAreaType(TestOTAreaSet.NoMergeAndRemove, false, true),
      new OTAreaType(TestOTAreaSet.NoMergeAndNoRemove, false, false)
    ], areas)
  }
}

describe('OTAreaSet - Initialization', () => {
  it('invalid arguments', () => {
    const validType = new OTAreaType('text', false, false)

    expect(() => new OTAreaSet([validType])).to.not.throw()
    expect(() => new OTAreaSet()).to.throw()
    expect(() => new OTAreaSet([validType, null])).to.throw()
  })
})

describe('OTAreaSet - forceRemove', () => {
  it('effective removeOnEmpty after forceRemove', () => {
    const actual = new TestOTAreaSet([
      new OTArea(TestOTAreaSet.NoMergeAndRemove, 0, 5),
      new OTArea(TestOTAreaSet.NoMergeAndRemove, 15, 20),
      new OTArea(TestOTAreaSet.NoMergeAndRemove, 30, 35)
    ]).forceRemove(10, 25)

    const expected = new TestOTAreaSet([
      new OTArea(TestOTAreaSet.NoMergeAndRemove, 0, 5),
      new OTArea(TestOTAreaSet.NoMergeAndRemove, 15, 20)
    ])

    expect(actual).to.deep.equal(expected)
  })
})
