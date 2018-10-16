<template>
  <div id="editor">
    <div class="editor-top-wrap">
      <input class="elicast-title" v-model.trim="elicastTitle">
      <div class="play-status">
        <span v-show="playMode === PlayMode.PLAYBACK">
          <font-awesome-icon icon="circle" class="text-info"/>
          Playing...
        </span>
        <span v-show="playMode === PlayMode.PAUSE">
          <font-awesome-icon icon="circle" />
          Paused
        </span>
        <span v-show="playMode === PlayMode.STANDBY">
          <font-awesome-icon icon="circle" class="text-primary"/>
          Standby
        </span>
        <span v-show="playMode === PlayMode.RECORD">
          <font-awesome-icon icon="circle" class="text-danger"/>
          Recording...
        </span>
      </div>
    </div>
    <div class="code-wrap">
      <codemirror ref="cm"
                  v-model="code"
                  :options="editorOptions"
                  @beforeChange="handleEditorBeforeChange"
                  @change="handleEditorChange"
                  @cursorActivity="handleEditorCursorActivity">
      </codemirror>

      <div class="code-right-pane">
        <div class="pause-controls code-right-pane-controls"
             v-show="playMode === PlayMode.PAUSE">
          <button class="btn btn-sm btn-light"
                  :disabled="!playModeReady"
                  @click="cutOts">
            <font-awesome-icon icon="cut" /> Cut Here
          </button>
        </div>

        <div class="assert-controls code-right-pane-controls"
             v-show="playMode === PlayMode.ASSERT">
          <button class="btn btn-sm btn-light"
                  :disabled="!playModeReady"
                  @click="runCode">
            <font-awesome-icon icon="terminal" /> Run
          </button>
        </div>

        <div class="record-controls code-right-pane-controls"
             v-show="playMode === PlayMode.RECORD || playMode === PlayMode.RECORD_PAST">
          <button class="btn btn-sm btn-light"
                  :disabled="!playModeReady"
                  @click="runCode">
            <font-awesome-icon icon="terminal" /> Run
          </button>
        </div>

        <RunOutputView :output="runOutput"></RunOutputView>
      </div>

      <Toast ref="toast" class="toast-wrap"></Toast>
    </div>

    <div class="controls-edit-history"
         v-show="!playMode.isRecording() && playMode !== PlayMode.PLAYBACK">
      <div>
        <div class="card bg-light">
          <h6 class="card-title">
            <font-awesome-icon icon="magic" />
            Edit History
          </h6>

          <div class="btn-group btn-group-sm" role="group"
               v-show="playMode === PlayMode.PAUSE || playMode === PlayMode.STANDBY">
            <button type="button"
                    class="btn btn-warning"
                    @click="handleTimelineSelectionStart"
                    :disabled="playMode !== PlayMode.PAUSE">
              <font-awesome-icon icon="clock" />
              Timeline Selection
            </button>
            <!-- <button type="button"
                    class="btn btn-warning"
                    :disabled="playMode !== PlayMode.STANDBY">
              <font-awesome-icon icon="font" />
              Text Selection
            </button> -->
          </div>

          <div class="btn-group btn-group-sm" role="group"
               v-show="playMode === PlayMode.TIMELINE_SELECT">
            <button type="button"
                    class="btn btn-warning"
                    v-show="playMode === PlayMode.TIMELINE_SELECT"
                    @click="handleTimelineSelectionFinish">
              Edit Selection
            </button>
            <button type="button"
                    class="btn btn-secondary"
                    v-show="playMode === PlayMode.TIMELINE_SELECT"
                    @click="handleTimelineSelectionCancel">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="controls">
      <button ref="controlButton"
              class="btn btn-sm btn-light"
              @click="togglePlayMode"
              :disabled="!playModeReady">
        <font-awesome-icon v-show="playMode === PlayMode.PAUSE" icon="play" />
        <font-awesome-icon v-show="playMode === PlayMode.TIMELINE_SELECT" icon="play"/>
        <font-awesome-icon v-show="playMode === PlayMode.PLAYBACK" icon="pause" />
        <font-awesome-icon v-show="playMode === PlayMode.STANDBY" icon="video" />
        <font-awesome-icon v-show="playMode.isRecording()" icon="video" class="text-danger" />
      </button>

      <Slider ref="slider"
              class="slider"
              @change="handleSliderChange"
              @startSelection="handleSliderStartSelection"
              :color="sliderColor"
              :max="maxTs"
              :disabled="playMode.isRecording() || !playModeReady"
              :ticks="sliderTicks"
              :overlays="sliderOverlays"></Slider>

      <div class="ts-display text-secondary">
        {{ tsDisplay }}
      </div>
    </div>

    <ConflictResolver ref="conflictResolver"></ConflictResolver>
  </div>
</template>

<script src="./Editor.js"></script>

<style lang="scss">
.editor-top-wrap {
  position: relative;
}

.elicast-title {
  max-width: 100%;
  margin: 0;
  padding: 0;
  outline: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: none;
  border: none;
  box-shadow: none;
  display: inline-block;
  font-size: 2rem;
  width: 100%;
}

.play-status {
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: 100;
}

.record-controls button {
  background-color: transparentize(red, 0.925);
  border-color: transparent;

  &:hover {
    background-color: transparentize(red, 0.85);
    border-color: transparentize(red, 0.85);
  }
}

.CodeMirror {
  $readonlyBackgroundColor: rgba(0, 0, 0, 0.066);

  .CodeMirror-line::after {
    pointer-events: none;
    color: #E0E0E0;
    content: "¬";
  }

  .added-ot-area {
    background-color: rgba(163, 235, 169, 0.4);
  }

  .recording-exercise ~ & {
    background-color: $readonlyBackgroundColor;
  }

  .recording-assert ~ & {
    background-color: $readonlyBackgroundColor;
  }

  .recording-exercise-block {
    padding: 0.2em 0;
    border-radius: 0.2em;
    background-color: rgba(255, 255, 255, 0.7);
  }
  .recording-assert-block {
    padding: 0.2em 0;
    border-radius: 0.2em;
    background-color: rgba(255, 255, 255, 0.7);
  }
}

.controls-edit-history {
  margin-top: -5em;
  height: 5em;

  & > div {
    position: absolute;
    left: 50%;
  }

  .card {
    position: relative;
    left: -50%;
    z-index: 100; // above CodeMirror's z-index
    display: inline-block;
    padding: 1em;
  }
}
</style>
