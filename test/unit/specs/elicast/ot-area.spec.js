import OTArea from '@/elicast/ot-area'

describe('OTArea', () => {
  it('initialization', () => {
    const validType = 'a'
    const validFromPos = 1
    const validToPos = 2

    expect(() => new OTArea(1, validFromPos, validToPos)).to.throw()
    expect(() => new OTArea(validType, 'invalid', validToPos)).to.throw()
    expect(() => new OTArea(validType, validFromPos, 'invalid')).to.throw()
    expect(() => new OTArea(validType, 2, 1)).to.throw()
  })

  it('clone', () => {
    const actual = new OTArea('test', 1, 10).clone()
    const expected = new OTArea('test', 1, 10)
    expect(actual).to.deep.equal(expected)
  })

  it('length', () => {
    const area = new OTArea('test', 1, 10).length()
    expect(area).to.equal(9)
  })

  it('isOverlapInclusive', () => {
    const area = new OTArea('test', 1, 10)
    expect(area.isOverlapInclusive(0, 0)).to.equal(false)
    expect(area.isOverlapInclusive(11, 11)).to.equal(false)
    expect(area.isOverlapInclusive(0, 5)).to.equal(true)
    expect(area.isOverlapInclusive(5, 11)).to.equal(true)
    expect(area.isOverlapInclusive(5, 6)).to.equal(true)
  })
})
