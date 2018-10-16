import AmbiguousAreaSetCouple from '@/elicast/ambiguous-area-set-couple'
import AmbiguousAreaSet from '@/elicast/ambiguous-area-set'
import OTArea from '@/elicast/ot-area'
import { ElicastText } from '@/elicast/elicast-ot-set'

// Example 1: a -> ab 에서 a -> ax 넣으면
// Init: a[] ~ a[x]
// Ot1 : ab[] ~ ab[x]
//       a[]b ~ a[x]b
//       ab   ~ ab

// Example 2: a -> ab 에서 a -> axyz 넣으면
// Init: a[] ~ a[xyz]
// Ot1 : ab[]   ~ ab[xyz]
//       a[]b[] ~ a[x]b[yz]
//       a[]b[] ~ a[xy]b[z]
//       a[]b   ~ a[xyz]b
//       ab[]   ~ ab[yz]
//       a[]b[] ~ a[x]b[z]
//       a[]b   ~ a[xy]b
//       ab[]   ~ ab[z]
//       a[]b   ~ a[x]b
//       ab     ~ ab

// Example 3: abcd -> abxcd 에서 abcd -> apqrd 넣으면
// Init: a[bc]d ~ a[pqr]d
// Ot1 : a[b]x[c]d ~ a[]x[pqr]d
//       a[b]x[c]d ~ a[p]x[qr]d
//       a[b]x[c]d ~ a[pq]x[r]d
//       a[b]x[c]d ~ a[pqr]x[]d
//       a[b]x[c]d ~ a[]x[qr]d
//       a[b]x[c]d ~ a[p]x[r]d
//       a[b]x[c]d ~ a[pq]x[]d
//       a[b]x[c]d ~ a[]x[r]d
//       a[b]x[c]d ~ a[p]x[]d
//       a[b]x[c]d ~ a[]x[]d

// Example 4: abc -> x 에서 abc -> abcd 넣으면
// Init: abc[] ~ abc[d]
// Ot1 : x[] ~ x[d]
//       x   ~ x

// Example 5: abcde -> axe 에서 abcde -> yabcde 를 넣고 yabcde -> yabpqrde 넣으면
// Init: []ab[c]de ~ [y]ab[pqr]de
// Ot1 : []axe ~ [y]axe

describe('AmbiguousAreaSetCouple - Initialization', () => {
  it('a[] ~ a[xyz]', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 1, 'xyz', '')
    ])

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 1)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 4)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('a[xyz] ~ a[]', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 4, '', 'xyz')
    ])

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 4)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 1)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('[]ab[c]de ~ [y]ab[pqr]de', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 0, 0, 'y', ''),
      new ElicastText(0, 3, 4, 'pqr', 'c')
    ])

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 0, 0),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 3)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 0, 1),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 6)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })
})

describe('AmbiguousAreaSetCouple - insert (zero-length ambiguity on original part)', () => {
  it('inserted to leftside (a[] ~ a[xyz] -> ab[] ~ ab[xyz])', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 1, 'xyz', '')
    ]).insert(
      new ElicastText(0, 1, 1, 'b', ''),
      new ElicastText(0, 1, 1, 'b', '')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 2)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 5)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted in middle (a[] ~ a[xyz] -> a[]b[] ~ a[x]b[yz])', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 1, 'xyz', '')
    ]).insert(
      new ElicastText(0, 1, 1, 'b', ''),
      new ElicastText(0, 2, 2, 'b', '')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 1),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 2)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 5)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted to rightside (a[] ~ a[xyz] -> a[]b ~ a[xyz]b)', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 1, 'xyz', '')
    ]).insert(
      new ElicastText(0, 1, 1, 'b', ''),
      new ElicastText(0, 4, 4, 'b', '')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 1)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 4)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted with replacing some left part (a[] ~ a[xyz] -> ab[] ~ ab[yz])', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 1, 'xyz', '')
    ]).insert(
      new ElicastText(0, 1, 1, 'b', ''),
      new ElicastText(0, 1, 2, 'b', 'x')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 2)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 4)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted with replacing some middle part (a[] ~ a[xyz] -> a[]b[] ~ a[x]b[z])', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 1, 'xyz', '')
    ]).insert(
      new ElicastText(0, 1, 1, 'b', ''),
      new ElicastText(0, 2, 3, 'b', 'y')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 1),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 2)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 4)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted with replacing some right part (a[] ~ a[xyz] -> a[]b   ~ a[xy]b)', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 1, 'xyz', '')
    ]).insert(
      new ElicastText(0, 1, 1, 'b', ''),
      new ElicastText(0, 3, 4, 'b', 'z')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 1)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 3)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted with replacing whole (a[] ~ a[xyz] -> ab ~ ab)', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 1, 'xyz', '')
    ]).insert(
      new ElicastText(0, 1, 1, 'b', ''),
      new ElicastText(0, 1, 4, 'b', 'xyz')
    )

    const expectedOriginal = new AmbiguousAreaSet()
    const expectedCurrent = new AmbiguousAreaSet()

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })
})

describe('AmbiguousAreaSetCouple - insert', () => {
  it('inserted to leftside (a[bc]d ~ a[pqr]d -> a[b]x[c]d ~ a[]x[pqr]d)', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 3, 'pqr', 'bc')
    ]).insert(
      new ElicastText(0, 2, 2, 'x', ''),
      new ElicastText(0, 1, 1, 'x', '')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 4)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 1),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 5)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted to middle (a[bc]d ~ a[pqr]d -> a[b]x[c]d ~ a[p]x[qr]d)', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 3, 'pqr', 'bc')
    ]).insert(
      new ElicastText(0, 2, 2, 'x', ''),
      new ElicastText(0, 2, 2, 'x', '')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 4)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 5)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted to rightside (a[bc]d ~ a[pqr]d -> a[b]x[c]d ~ a[pqr]x[]d)', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 3, 'pqr', 'bc')
    ]).insert(
      new ElicastText(0, 2, 2, 'x', ''),
      new ElicastText(0, 4, 4, 'x', '')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 4)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 4),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 5, 5)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted with replacing some left part (a[bc]d ~ a[pqr]d -> a[b]x[c]d ~ a[]x[qr]d)', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 3, 'pqr', 'bc')
    ]).insert(
      new ElicastText(0, 2, 2, 'x', ''),
      new ElicastText(0, 1, 2, 'x', 'p')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 4)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 1),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 4)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted with replacing some middle part (a[bc]d ~ a[pqr]d -> a[b]x[c]d ~ a[p]x[r]d)', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 3, 'pqr', 'bc')
    ]).insert(
      new ElicastText(0, 2, 2, 'x', ''),
      new ElicastText(0, 2, 3, 'x', 'q')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 4)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 4)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted with replacing some right part (a[bc]d ~ a[pqr]d -> a[b]x[c]d ~ a[pq]x[]d)', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 3, 'pqr', 'bc')
    ]).insert(
      new ElicastText(0, 2, 2, 'x', ''),
      new ElicastText(0, 3, 4, 'x', 'r')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 4)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 3),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 4, 4)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })

  it('inserted with replacing whole (a[bc]d ~ a[pqr]d -> a[b]x[c]d ~ a[]x[]d)', () => {
    const ambiguousCouple = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 3, 'pqr', 'bc')
    ]).insert(
      new ElicastText(0, 2, 2, 'x', ''),
      new ElicastText(0, 1, 4, 'x', 'pqr')
    )

    const expectedOriginal = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 2),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 3, 4)
    ])
    const expectedCurrent = new AmbiguousAreaSet([
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 1, 1),
      new OTArea(AmbiguousAreaSet.AMBIGUOUS, 2, 2)
    ])

    expect(expectedOriginal).to.deep.equal(ambiguousCouple.original)
    expect(expectedCurrent).to.deep.equal(ambiguousCouple.current)
  })
})

describe('AmbiguousAreaSetCouple - getPossibleResolveOtRange', () => {
  it('ab -> b inserted with ab -> xyab', () => {
    const actual = new AmbiguousAreaSetCouple([
      new ElicastText(0, 0, 0, 'xy', '')
    ]).getPossibleResolveOtRange(0, 1)

    const expected = [
      { from: 0, to: 2 },
      { from: 3, to: 3 }
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('abcde -> abde inserted with xyczk', () => {
    const actual = new AmbiguousAreaSetCouple([
      new ElicastText(0, 0, 2, 'xy', 'ab'),
      new ElicastText(0, 3, 5, 'de', 'zk')
    ]).getPossibleResolveOtRange(2, 3)

    const expected = [
      { from: 0, to: 2 },
      { from: 3, to: 5 }
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('_ -> a inserted with _ -> xx', () => {
    const actual = new AmbiguousAreaSetCouple([
      new ElicastText(0, 0, 0, 'xx', '')
    ]).getPossibleResolveOtRange(0, 0)

    const expected = [
      { from: 0, to: 2 },
      { from: 0, to: 2 }
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('a -> ab inserted with a -> ax', () => {
    const actual = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 1, 'x', '')
    ]).getPossibleResolveOtRange(1, 1)

    const expected = [
      { from: 1, to: 2 },
      { from: 1, to: 2 }
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('a -> ab inserted with a -> axyz', () => {
    const actual = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 1, 'xyz', '')
    ]).getPossibleResolveOtRange(1, 1)

    const expected = [
      { from: 1, to: 4 },
      { from: 1, to: 4 }
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('abcd -> abxcd inserted with abcd -> apqrd', () => {
    const actual = new AmbiguousAreaSetCouple([
      new ElicastText(0, 1, 3, 'pqr', 'bc')
    ]).getPossibleResolveOtRange(2, 2)

    const expected = [
      { from: 1, to: 4 },
      { from: 1, to: 4 }
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('abc -> x inserted with abc -> abcd', () => {
    const actual = new AmbiguousAreaSetCouple([
      new ElicastText(0, 3, 3, 'd', '')
    ]).getPossibleResolveOtRange(0, 3)

    const expected = [
      { from: 0, to: 0 },
      { from: 3, to: 4 }
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('abc -> x inserted with abc -> dabc', () => {
    const actual = new AmbiguousAreaSetCouple([
      new ElicastText(0, 0, 0, 'd', '')
    ]).getPossibleResolveOtRange(0, 3)

    const expected = [
      { from: 0, to: 1 },
      { from: 4, to: 4 }
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('abcde -> axe inserted with abcde -> abcdey', () => {
    const actual = new AmbiguousAreaSetCouple([
      new ElicastText(0, 5, 5, 'y', '')
    ]).getPossibleResolveOtRange(1, 4)

    const expected = [
      { from: 1, to: 1 },
      { from: 4, to: 4 }
    ]

    expect(actual).to.deep.equal(expected)
  })

  it('abcde -> axe inserted with abcde -> yabcde and yabcde -> yabpqrde', () => {
    const actual = new AmbiguousAreaSetCouple([
      new ElicastText(0, 0, 0, 'y', ''),
      new ElicastText(0, 3, 4, 'pqr', 'c')
    ]).getPossibleResolveOtRange(1, 4)

    const expected = [
      { from: 2, to: 2 },
      { from: 7, to: 7 }
    ]

    expect(actual).to.deep.equal(expected)
  })
})
