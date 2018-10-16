<template>
  <div class="slider" :disabled="disabled">
    <canvas ref="canvas"
            :width="width"
            :height="height"
            @mousedown="handleMousedown">
    </canvas>
  </div>
</template>

<script>
import _ from 'lodash'
import Color from 'color'
import jQuery from 'jquery'

const WIDTH_PADDING = 10
const SLIDE_HEIGHT = 4
const THUMB_WIDTH = 4
const THUMB_HEIGHT = 10
const DISABLED_ALPHA = 0.5
const DEFAULT_COLOR = 'black'
const SELECT_COLOR = '#ffc107'

export default {
  props: {
    min: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: 0
    },
    disabled: {
      type: Boolean,
      default: false
    },
    color: {
      type: String,
      default: DEFAULT_COLOR
    },
    ticks: {
      type: Array,
      default: () => []
    },
    overlays: {
      type: Array,
      default: () => []
    }
  },

  data () {
    return {
      width: 0, // resized
      height: 10,

      val: 0,

      selectFrom: -1,
      selectTo: -1
    }
  },

  computed: {
    slideWidth () {
      return this.width - WIDTH_PADDING
    },
    slideLeft () {
      return WIDTH_PADDING / 2
    },
    slideRight () {
      return this.width - WIDTH_PADDING / 2
    },
    isSelecting () {
      return this.selectFrom >= 0 && this.selectTo < 0
    },
    isSelectionHeld () {
      return this.selectFrom >= 0 && this.selectTo >= 0
    }
  },

  watch: {
    min (min) {
      if (this.val < min) {
        this.val = min
      } else {
        this.$emit('change', this.val, false)
        this.draw()
      }
    },
    max (max) {
      if (this.val > max) {
        this.val = max
      } else {
        this.$emit('change', this.val, false)
        this.draw()
      }
    },
    val (val, prevVal) {
      this.$emit('change', val, this.isMouseDown)
      this.draw()
    },
    selectFrom (selectFrom, prevSelectFrom) {
      if (prevSelectFrom < 0 && selectFrom >= 0) {
        this.$emit('startSelection', selectFrom)
      }
      this.draw()
    },
    selectTo () {
      this.draw()
    },
    width () { this.drawDebounce() },
    height () { this.drawDebounce() },
    disabled () { this.draw() }
  },

  mounted () {
    window.addEventListener('resize', this.handleWindowResize)

    this.width = this.$el.clientWidth
  },

  beforeDestroy () {
    window.removeEventListener('resize', this.handleWindowResize)
  },

  methods: {
    handleWindowResize (e) {
      this.layout()
    },

    handleMousedown (e) {
      if (this.disabled) return false

      if (e.which === 1 || e.buttons === 1) {
        e.preventDefault()

        this.isMouseDown = true

        // no selection & shift key pressed : start selection
        if (e.shiftKey && this.selectFrom < 0) {
          this.startSelection()
        }

        this.slide(e.offsetX)

        document.addEventListener('mousemove', this.handleDocumentMousemove)
        document.addEventListener('mouseup', this.handleDocumentMouseup)
      }
      return false
    },

    handleDocumentMousemove (e) {
      if (this.isMouseDown) {
        e.preventDefault()

        let offsetX = e.pageX - jQuery(this.$el).offset().left
        this.slide(offsetX)
      }

      return false
    },

    handleDocumentMouseup (e) {
      if (this.isMouseDown) {
        this.isMouseDown = false

        document.removeEventListener('mousemove', this.handleDocumentMousemove)
        document.removeEventListener('mouseup', this.handleDocumentMouseup)
      }

      return false
    },

    layout () {
      this.width = this.$el.offsetWidth
    },

    slide (offset) {
      if (this.disabled) return false

      let newVal = this.offsetToVal(offset)
      if (this.isSelecting && newVal < this.selectFrom) {
        newVal = this.selectFrom
      }

      this.val = newVal
    },

    startSelection () {
      this.selectFrom = this.val
    },

    holdSelection () {
      this.selectTo = this.val
      return [this.selectFrom, this.selectTo]
    },

    adjustSelection (newSelectTo) {
      this.selectTo = newSelectTo
    },

    dropSelection () {
      this.val = this.selectFrom
      this.selectFrom = -1
      this.selectTo = -1
    },

    offsetToVal (offset) {
      offset = Math.max(this.slideLeft, Math.min(offset, this.slideRight))
      offset -= this.slideLeft
      return Math.round(this.min + offset / this.slideWidth * (this.max - this.min))
    },

    valToOffset (val) {
      val = (val - this.min) / (this.max - this.min)
      return val * this.slideWidth + this.slideLeft
    },

    drawDebounce: _.debounce(function () { this.draw() }, 100),

    draw () {
      function colorSlide (fromOffset, toOffset, color) {
        ctx.fillStyle = color
        ctx.fillRect(fromOffset, slideFromY, toOffset - fromOffset, SLIDE_HEIGHT)
      }

      function thumb (offset, color) {
        ctx.fillStyle = color
        ctx.fillRect(offset - THUMB_WIDTH / 2, 0, THUMB_WIDTH, THUMB_HEIGHT)
      }

      const canvas = this.$refs.canvas
      if (!canvas) return

      const ctx = canvas.getContext('2d')

      ctx.globalAlpha = this.disabled ? DISABLED_ALPHA : 1

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const color = Color(this.color)
      const offset = this.valToOffset(this.val)
      const slideFromY = canvas.height / 2 - SLIDE_HEIGHT / 2

      // background
      colorSlide(this.slideLeft, this.slideLeft + this.slideWidth, color.fade(0.8).string())

      // progress shade
      colorSlide(this.slideLeft, offset, color.fade(0.8).string())

      // overlays
      if (this.color === DEFAULT_COLOR) { // if not recording or etc.
        for (const overlay of this.overlays) {
          const fromOffset = this.valToOffset(overlay.from)
          const toOffset = this.valToOffset(overlay.to)

          colorSlide(fromOffset, toOffset, Color(overlay.color).fade(0.2).string())
        }
      }

      // select overlay
      if (this.isSelecting || this.isSelectionHeld) {
        const selectFromOffset = this.valToOffset(this.selectFrom)
        const selectToOffset = this.isSelecting ? offset : this.valToOffset(this.selectTo)

        // overlay
        colorSlide(selectFromOffset, selectToOffset, Color(SELECT_COLOR).lighten(0.4).string())
      }

      // ticks
      for (let tick of this.ticks) {
        const tickOffset = this.valToOffset(tick)

        ctx.fillStyle = color.fade(0.5)
        ctx.fillRect(tickOffset, slideFromY, 2, SLIDE_HEIGHT / 2)
      }

      // thumbs
      if (this.isSelecting || this.isSelectionHeld) {
        const selectFromOffset = this.valToOffset(this.selectFrom)
        const selectToOffset = this.isSelecting ? offset : this.valToOffset(this.selectTo)

        // left thumb
        thumb(selectFromOffset, Color(SELECT_COLOR).string())
        // right thumb
        thumb(selectToOffset, Color(SELECT_COLOR).string())

        if (this.isSelectionHeld) {
          // record thumb
          thumb(offset, color.string())
        }
      } else {
        // thumb
        thumb(offset, color.string())
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.slider[disabled] canvas {
  cursor: default;
}
.slider {
  overflow: hidden; // for resize

  canvas {
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
  }
}
</style>
