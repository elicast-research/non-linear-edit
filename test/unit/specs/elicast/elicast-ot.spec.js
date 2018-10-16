import ElicastOT, { OtInsertSuccess, OtInsertConflict, HistoryChar } from '@/elicast/elicast-ot'
import { ElicastSelection, ElicastText } from '@/elicast/elicast-ot-set'

describe('ElicastOT - insertOtsToOts (ElicastSelection)', () => {
  it('a -> {a} inserted with a -> ab resolves to {ab}', () => {
    const originalHistory = [new ElicastSelection(0, 0, 1)]
    const insertedHistory = [new ElicastText(0, 1, 1, 'b', '')]

    expect(ElicastOT.insertOtsToOts(originalHistory, 0, insertedHistory))
      .to.be.an.instanceOf(OtInsertConflict)

    const actual = ElicastOT.insertOtsToOts(originalHistory, 0, insertedHistory, [
      new ElicastSelection(0, 0, 2)
    ])
    const expectedOts = [
      new ElicastText(0, 1, 1, 'b', ''),
      new ElicastSelection(0, 0, 2)
    ]
    expect(actual).to.be.an.instanceOf(OtInsertSuccess)
    expect(actual.ots).to.deep.equal(expectedOts)
  })

  it('ab -> a{b} inserted with ab -> xab (no conflict)', () => {
    const originalHistory = [new ElicastSelection(0, 1, 2)]
    const insertedHistory = [new ElicastText(0, 0, 0, 'x', '')]

    const actual = ElicastOT.insertOtsToOts(originalHistory, 0, insertedHistory)
    const expectedOts = [
      new ElicastText(0, 0, 0, 'x', ''),
      new ElicastSelection(0, 2, 3)
    ]

    expect(actual).to.be.an.instanceOf(OtInsertSuccess)
    expect(actual.ots).to.deep.equal(expectedOts)
  })
})

describe('ElicastOT - insertOtsToOts (ElicastText)', () => {
  it('_ -> a inserted with _ -> xx resolves to xax', () => {
    const originalHistory = [new ElicastText(0, 0, 0, 'a', '')]
    const insertedHistory = [new ElicastText(0, 0, 0, 'xx', '')]

    expect(ElicastOT.insertOtsToOts(originalHistory, 0, insertedHistory))
      .to.be.an.instanceOf(OtInsertConflict)

    const actual = ElicastOT.insertOtsToOts(originalHistory, 0, insertedHistory, [
      new ElicastText(0, 1, 1, 'a', '')
    ])
    const expectedOts = [
      new ElicastText(0, 0, 0, 'xx', ''),
      new ElicastText(0, 1, 1, 'a', '')
    ]

    expect(actual).to.be.an.instanceOf(OtInsertSuccess)
    expect(actual.ots).to.deep.equal(expectedOts)
  })

  it('_ -> a -> b inserted with _ -> xx resolves to axxb', () => {
    const originalHistory = [
      new ElicastText(0, 0, 0, 'a', ''),
      new ElicastText(0, 1, 1, 'b', '')
    ]
    const insertedHistory = [new ElicastText(0, 0, 0, 'xx', '')]

    const actual = ElicastOT.insertOtsToOts(originalHistory, 0, insertedHistory, [
      new ElicastText(0, 0, 0, 'a', ''),
      new ElicastText(0, 3, 3, 'b', '')
    ])
    const expectedOts = [
      new ElicastText(0, 0, 0, 'xx', ''),
      new ElicastText(0, 0, 0, 'a', ''),
      new ElicastText(0, 3, 3, 'b', '')
    ]

    expect(actual).to.be.an.instanceOf(OtInsertSuccess)
    expect(actual.ots).to.deep.equal(expectedOts)
  })

  it('a -> ab inserted with a -> xa (no conflict)', () => {
    const originalHistory = [
      new ElicastText(0, 0, 0, 'a', ''),
      new ElicastText(0, 1, 1, 'b', '')
    ]
    const insertedHistory = [
      new ElicastText(0, 0, 0, 'x', '')
    ]

    const actual = ElicastOT.insertOtsToOts(originalHistory, 1, insertedHistory)
    const expectedOts = [
      new ElicastText(0, 0, 0, 'a', ''),
      new ElicastText(0, 0, 0, 'x', ''),
      new ElicastText(0, 2, 2, 'b', '')
    ]

    expect(actual).to.be.an.instanceOf(OtInsertSuccess)
    expect(actual.ots).to.deep.equal(expectedOts)
  })
})

describe('ElicastOT - replacePartOfHistory', () => {
  it('a -> ab -> abc become a -> ax -> axy (no conflict)', () => {
    const originalHistory = [
      new ElicastText(0, 1, 1, 'b', ''),
      new ElicastText(0, 2, 2, 'c', '')
    ]
    const insertedHistory = [
      new ElicastText(0, 1, 1, 'x', ''),
      new ElicastText(0, 2, 2, 'y', '')
    ]

    const actual = ElicastOT.replacePartOfHistory(originalHistory, 0, 2, insertedHistory)
    const expectedOts = [
      new ElicastText(0, 1, 1, 'x', ''),
      new ElicastText(0, 2, 2, 'y', '')
    ]

    expect(actual).to.be.an.instanceOf(OtInsertSuccess)
    expect(actual.ots).to.deep.equal(expectedOts)
  })

  it('a -> a( -> a(c become a -> a() -> a(c)', () => {
    const originalHistory = [
      new ElicastText(0, 1, 1, '(', ''),
      new ElicastText(0, 2, 2, 'c', '')
    ]
    const insertedHistory = [
      new ElicastText(0, 1, 1, '()', '')
    ]

    expect(ElicastOT.replacePartOfHistory(originalHistory, 0, 1, insertedHistory))
      .to.be.an.instanceOf(OtInsertConflict)

    const actual = ElicastOT.replacePartOfHistory(originalHistory, 0, 1, insertedHistory, [
      new ElicastText(0, 2, 2, 'c', '')
    ])
    const expectedOts = [
      new ElicastText(0, 1, 1, '()', ''),
      new ElicastText(0, 2, 2, 'c', '')
    ]

    expect(actual).to.be.an.instanceOf(OtInsertSuccess)
    expect(actual.ots).to.deep.equal(expectedOts)
  })

  it('a -> ab -> abc become () -> (a) -> (ab) -> (abc)', () => {
    const originalHistory = [
      new ElicastText(0, 0, 0, 'a', ''),
      new ElicastText(0, 1, 1, 'b', ''),
      new ElicastText(0, 2, 2, 'c', '')
    ]
    const insertedHistory = [
      new ElicastText(0, 0, 0, '()', '')
    ]

    expect(ElicastOT.replacePartOfHistory(originalHistory, 0, 0, insertedHistory))
      .to.be.an.instanceOf(OtInsertConflict)

    expect(ElicastOT.replacePartOfHistory(originalHistory, 0, 0, insertedHistory, [
      new ElicastText(0, 1, 1, 'a', '')
    ])).to.be.an.instanceOf(OtInsertConflict)

    expect(ElicastOT.replacePartOfHistory(originalHistory, 0, 0, insertedHistory, [
      new ElicastText(0, 1, 1, 'a', ''),
      new ElicastText(0, 2, 2, 'b', '')
    ])).to.be.an.instanceOf(OtInsertConflict)

    const actual = ElicastOT.replacePartOfHistory(originalHistory, 0, 0, insertedHistory, [
      new ElicastText(0, 1, 1, 'a', ''),
      new ElicastText(0, 2, 2, 'b', ''),
      new ElicastText(0, 3, 3, 'c', '')
    ])
    const expectedOts = [
      new ElicastText(0, 0, 0, '()', ''),
      new ElicastText(0, 1, 1, 'a', ''),
      new ElicastText(0, 2, 2, 'b', ''),
      new ElicastText(0, 3, 3, 'c', '')
    ]

    expect(actual).to.be.an.instanceOf(OtInsertSuccess)
    expect(actual.ots).to.deep.equal(expectedOts)
  })
})

describe('ElicastOT - generateTombstone', () => {
  function docToString (doc) {
    return doc.filter(historyChar => !historyChar.isTombstone())
      .map(historyChar => historyChar.char)
      .join('')
  }

  it('happy case', () => {
    const doc = ElicastOT.generateTombstone([
      new ElicastText(0, 0, 0, 'a', ''),
      new ElicastText(1, 1, 1, 'b', ''),
      new ElicastText(2, 2, 2, 'c', ''),
      new ElicastText(3, 0, 2, 'de', 'ab')
    ])

    expect(docToString(doc)).to.be.deep.equal('dec')

    // TODO check removedTs
  })

  it('another happy case', () => {
    const doc = ElicastOT.generateTombstone([
      new ElicastText(0, 0, 0, '호엉이', ''),
      new ElicastText(1, 1, 1, '으어어', ''),
      new ElicastText(2, 0, 1, '허', '호')
    ])

    expect(docToString(doc)).to.be.deep.equal('허으어어엉이')
  })
})
