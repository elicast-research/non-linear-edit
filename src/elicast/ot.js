import _ from 'lodash'

export default class OT {
  constructor (ts, command) {
    if (!_.isInteger(ts)) throw new Error('Invalid type of ts')
    if (!_.isString(command)) throw new Error('Invalid type of command')

    this.ts = ts
    this.command = command
  }
}
