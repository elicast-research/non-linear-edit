import _ from 'lodash'

import OT from './ot'

export default class ElicastOTSet extends OT {
  static fromJSON (otRaw) {
    return OT_CLASS_MAP[otRaw.command].fromJSON(otRaw)
  }

  inverse () {
    // default implementation
    return this.clone()
  }

  clone () {
    // Use `Object.assign` to preserve `_attributes`
    return Object.assign(ElicastOTSet.fromJSON(this), this)
  }
}

export class ElicastNop extends ElicastOTSet {
  static COMMAND = 'nop'

  constructor (ts, time = Date.now()) {
    super(ts, ElicastNop.COMMAND)

    if (!_.isInteger(time)) throw new Error('Invalid type of time')

    this.time = time
  }

  static fromJSON (ot) {
    return new this(ot.ts, ot.time)
  }

  getRelativeTS (time = Date.now()) {
    return this.ts + time - this.time
  }
}

export class ElicastRecordStart extends ElicastOTSet {
  static COMMAND = 'record_start'

  constructor (ts, soundChunkIdx, time = Date.now(), soundOffset = 0) {
    super(ts, ElicastRecordStart.COMMAND)

    if (!_.isInteger(soundChunkIdx)) throw new Error('Invalid type of soundChunkIdx')
    if (!_.isInteger(time)) throw new Error('Invalid type of time')
    if (!_.isInteger(soundOffset)) throw new Error('Invalid type of soundOffset')

    this.soundChunkIdx = soundChunkIdx
    this.time = time
    this.soundOffset = soundOffset
  }

  static fromJSON (ot) {
    return new this(ot.ts, ot.soundChunkIdx, ot.time, ot.soundOffset)
  }

  getRelativeTS (time = Date.now()) {
    return this.ts + time - this.time
  }
}

export class ElicastRecordEnd extends ElicastOTSet {
  static COMMAND = 'record_end'

  constructor (ts) {
    super(ts, ElicastRecordEnd.COMMAND)
  }

  static fromJSON (ot) {
    return new this(ot.ts)
  }
}

export class ElicastSelection extends ElicastOTSet {
  static COMMAND = 'selection'

  constructor (ts, fromPos, toPos) {
    super(ts, ElicastSelection.COMMAND)

    if (!_.isInteger(fromPos)) throw new Error('Invalid type of fromPos')
    if (!_.isInteger(toPos)) throw new Error('Invalid type of toPos')
    if (!(fromPos >= 0 && toPos >= 0)) throw new Error('fromPos and toPos must be non-negative')

    this.fromPos = fromPos
    this.toPos = toPos
  }

  static fromJSON (ot) {
    return new this(ot.ts, ot.fromPos, ot.toPos)
  }
}

export class ElicastText extends ElicastOTSet {
  static COMMAND = 'text'

  constructor (ts, fromPos, toPos, insertedText, removedText) {
    super(ts, ElicastText.COMMAND)

    if (!_.isInteger(fromPos)) throw new Error('Invalid type of fromPos')
    if (!_.isInteger(toPos)) throw new Error('Invalid type of toPos')
    if (!(fromPos >= 0 && toPos >= 0)) throw new Error('fromPos and toPos must be non-negative')
    if (!(fromPos <= toPos)) throw new Error('toPos must be greater than fromPos')
    if (!_.isString(insertedText)) throw new Error('Invalid type of insertedText')
    if (!_.isString(removedText)) throw new Error('Invalid type of removedText')
    if (!(toPos - fromPos === removedText.length)) throw new Error('Invalid removedText length')

    this.fromPos = fromPos
    this.toPos = toPos
    this.insertedText = insertedText
    this.removedText = removedText
  }

  static fromJSON (ot) {
    return new this(ot.ts, ot.fromPos, ot.toPos, ot.insertedText, ot.removedText)
  }

  inverse () {
    return new ElicastText(this.ts, this.fromPos, this.getAfterToPos(), this.removedText, this.insertedText)
  }

  getBeforeToPos () {
    return this.fromPos + this.removedText.length
  }

  getAfterToPos () {
    return this.fromPos + this.insertedText.length
  }
}

export class ElicastExercise extends ElicastOTSet {
  static COMMAND = 'exPlaceholder'

  constructor (ts, exId) {
    super(ts, ElicastExercise.COMMAND)

    if (!_.isInteger(exId)) throw new Error('Invalid type of exId')
    if (!(exId >= 0)) throw new Error('Invalid exId')

    this.exId = exId
  }

  static fromJSON (ot) {
    return new this(ot.ts, ot.exId)
  }
}

export class ElicastExerciseShow extends ElicastOTSet {
  static COMMAND = 'exShow'

  constructor (ts, exId, description) {
    super(ts, ElicastExerciseShow.COMMAND)

    if (!_.isInteger(exId)) throw new Error('Invalid type of exId')
    if (!(exId >= 0)) throw new Error('Invalid exId')
    if (!_.isString(description)) throw new Error('Invalid type of description')

    this.exId = exId
    this.description = description
  }

  static fromJSON (ot) {
    return new this(ot.ts, ot.exId, ot.description)
  }
}

export class ElicastRun extends ElicastOTSet {
  static COMMAND = 'run'

  constructor (ts, exitCode, output) {
    super(ts, ElicastRun.COMMAND)

    if (!(_.isInteger(exitCode) || _.isNil(exitCode))) throw new Error('Invalid type of exitCode')
    if (!(_.isString(output) || _.isNil(output))) throw new Error('Invalid type of output')
    if (_.isNil(exitCode) && !_.isNil(output)) throw new Error('Invalid output')

    this.exitCode = exitCode
    this.output = output
  }

  isRunning () {
    return _.isNil(this.exitCode)
  }

  static fromJSON (ot) {
    return new this(ot.ts, ot.exitCode, ot.output)
  }
}

export class ElicastAssert extends ElicastOTSet {
  static COMMAND = 'assert'

  constructor (ts, time = Date.now()) {
    super(ts, ElicastAssert.COMMAND)

    if (!_.isInteger(time)) throw new Error('Invalid type of time')

    this.time = time
  }

  static fromJSON (ot) {
    return new this(ot.ts, ot.time)
  }

  getRelativeTS (time = Date.now()) {
    return this.ts + time - this.time
  }
}

const OT_CLASS_MAP = _.keyBy([
  ElicastNop,
  ElicastRecordStart,
  ElicastRecordEnd,
  ElicastSelection,
  ElicastText,
  ElicastExercise,
  ElicastExerciseShow,
  ElicastRun,
  ElicastAssert
], otClass => otClass.COMMAND)
