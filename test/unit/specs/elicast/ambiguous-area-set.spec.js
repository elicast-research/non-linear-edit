import AmbiguousAreaSet from '@/elicast/ambiguous-area-set'
import { ElicastText } from '@/elicast/elicast-ot-set'
import OTArea from '@/elicast/ot-area'

describe('AmbiguousAreaSet - Initialization', () => {
  it('_ -> ABC : [ABC]', () => {
    const newOts = [
      // _
      new ElicastText(0, 0, 0, 'ABC', '') // ABC
    ]

    const actual = AmbiguousAreaSet.fromOts(newOts)
      .toArray()

    const expected = [new OTArea(AmbiguousAreaSet.AMBIGUOUS, 0, 3)]

    expect(actual).to.deep.equal(expected)
  })

  it('B -> AB -> ABC : [A]B[C]', () => {
    const newOts = [
      // B
      new ElicastText(0, 0, 0, 'A', ''), // AB
      new ElicastText(0, 2, 2, 'C', '') // ABC
    ]

    const actual = AmbiguousAreaSet.fromOts(newOts)
      .toArray()

    const expected = [
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 0, 1),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 3)
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('_ -> B -> AB -> ABC : [ABC]', () => {
    const newOts = [
      // _
      new ElicastText(0, 0, 0, 'B', ''), // B
      new ElicastText(0, 0, 0, 'A', ''), // AB
      new ElicastText(0, 2, 2, 'C', '') // ABC
    ]

    const actual = AmbiguousAreaSet.fromOts(newOts)
      .toArray()

    const expected = [new OTArea(AmbiguousAreaSet.AMBIGUOUS, 0, 3)]

    expect(actual).to.deep.equal(expected)
  })

  it('ABC -> _ : []', () => {
    const newOts = [
      // ABC
      new ElicastText(0, 0, 3, '', 'ABC') // _
    ]

    const actual = AmbiguousAreaSet.fromOts(newOts)
      .toArray()

    const expected = [new OTArea(AmbiguousAreaSet.AMBIGUOUS, 0, 0)]

    expect(actual).to.deep.equal(expected)
  })

  it('ABCD -> AD -> ADE : A[]D[E]', () => {
    const newOts = [
      // ABCD
      new ElicastText(0, 1, 3, '', 'BC'), // AD
      new ElicastText(0, 2, 2, 'E', '') // ADE
    ]

    const actual = AmbiguousAreaSet.fromOts(newOts)
      .toArray()

    const expected = [
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 1),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 3)
    ]

    expect(actual).to.deep.equal(expected)
  })
})

describe('AmbiguousAreaSet - clone', () => {
  it('A[BC]D[EFG]', () => {
    const areaSet = new AmbiguousAreaSet()
      .insert(AmbiguousAreaSet.AMBIGUOUS, 1, 2)
      .insert(AmbiguousAreaSet.AMBIGUOUS, 4, 6)

    expect(areaSet).to.deep.equal(areaSet.clone())
  })
})

describe('AmbiguousAreaSet - insert', () => {
  it('ambiguous area is divided by nop', () => {
    const actual = new AmbiguousAreaSet()
      .insert(AmbiguousAreaSet.AMBIGUOUS, 10, 20)
      .insert(AmbiguousAreaSet.NOP, 15, 16)
      .toArray()

    const expected = [
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 10, 15),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 16, 21)
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('ambiguous area is divided by nop (with leftside empty)', () => {
    const actual = new AmbiguousAreaSet()
      .insert(AmbiguousAreaSet.AMBIGUOUS, 10, 20)
      .insert(AmbiguousAreaSet.NOP, 10, 11)
      .toArray()

    const expected = [
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 10, 10),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 11, 21)
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('ambiguous area is divided by nop (with rightside empty)', () => {
    const actual = new AmbiguousAreaSet()
      .insert(AmbiguousAreaSet.AMBIGUOUS, 10, 20)
      .insert(AmbiguousAreaSet.NOP, 20, 21)
      .toArray()

    const expected = [
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 10, 20),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 21, 21)
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('ambiguous area is divided by nop (empty to left/right empty)', () => {
    const actual = new AmbiguousAreaSet()
      .insert(AmbiguousAreaSet.AMBIGUOUS, 10, 10)
      .insert(AmbiguousAreaSet.NOP, 10, 11)
      .toArray()

    const expected = [
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 10, 10),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 11, 11)
    ]

    expect(actual).to.deep.equal(expected)
  })
})

describe('AmbiguousAreaSet - findAmbiguityAreas', () => {
  it('A[BC]D[EFG]', () => {
    const areaSet = new AmbiguousAreaSet()
      .insert(AmbiguousAreaSet.AMBIGUOUS, 1, 2)
      .insert(AmbiguousAreaSet.AMBIGUOUS, 4, 6)

    const [firstArea, secondArea] = areaSet.toArray()

    expect(areaSet.findAmbiguityAreas(0, 0)).to.be.empty
    expect(areaSet.findAmbiguityAreas(0, 1)).to.deep.equal([firstArea])
    expect(areaSet.findAmbiguityAreas(0, 2)).to.deep.equal([firstArea])
    expect(areaSet.findAmbiguityAreas(1, 1)).to.deep.equal([firstArea])
    expect(areaSet.findAmbiguityAreas(1, 2)).to.deep.equal([firstArea])
    expect(areaSet.findAmbiguityAreas(2, 2)).to.deep.equal([firstArea])
    expect(areaSet.findAmbiguityAreas(2, 3)).to.deep.equal([firstArea])
    expect(areaSet.findAmbiguityAreas(3, 3)).to.be.empty
    expect(areaSet.findAmbiguityAreas(3, 4)).to.deep.equal([secondArea])
    expect(areaSet.findAmbiguityAreas(3, 5)).to.deep.equal([secondArea])
    expect(areaSet.findAmbiguityAreas(3, 6)).to.deep.equal([secondArea])
    expect(areaSet.findAmbiguityAreas(3, 7)).to.deep.equal([secondArea])
    expect(areaSet.findAmbiguityAreas(4, 6)).to.deep.equal([secondArea])
    expect(areaSet.findAmbiguityAreas(5, 6)).to.deep.equal([secondArea])
    expect(areaSet.findAmbiguityAreas(6, 6)).to.deep.equal([secondArea])
    expect(areaSet.findAmbiguityAreas(7, 7)).to.be.empty
    expect(areaSet.findAmbiguityAreas(2, 4)).to.deep.equal([firstArea, secondArea])
    expect(areaSet.findAmbiguityAreas(1, 6)).to.deep.equal([firstArea, secondArea])
    expect(areaSet.findAmbiguityAreas(0, 7)).to.deep.equal([firstArea, secondArea])
  })
})
