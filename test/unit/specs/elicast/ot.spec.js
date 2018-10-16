import OT from '@/elicast/ot'

describe('OT', () => {
  it('initialization', () => {
    const validTs = 123
    const validCommand = 'test'

    expect(() => new OT('invalid', validCommand)).to.throw()
    expect(() => new OT(validTs, 123)).to.throw()
  })
})
