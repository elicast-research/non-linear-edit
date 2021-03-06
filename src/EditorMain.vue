<template>
  <div class="container-fluid">
    <div class="top-controls">
      <button v-show="displayLoadSaveButton"
              class="btn btn-sm btn-primary"
              @click="showLoadSaveModal">Load/Save</button>
      <button v-show="!displayLoadSaveButton"
              class="btn btn-sm btn-primary"
              @click="handleSaveButtonClick">Save</button>
    </div>
    <h5>/* Non-Linear Editor */</h5>
    <component ref="editorPlaceholder" :is="currentEditor"></component>
    <LoadSaveModal ref="loadSaveModal"
                   :enableRemoveButton="true"
                   @elicastLoaded="loadSaveModalElicastLoaded"
                   @elicastSaved="loadSaveModalElicastSaved"></LoadSaveModal>
  </div>
</template>

<script>
import _ from 'lodash'

import Elicast from '@/elicast/elicast'
import ElicastService from '@/elicast/elicast-service'
import ElicastEditor from '@/components/editor'
import LoadSaveModal from '@/components/LoadSaveModal'

const INIT_ELICAST = new Elicast(null, 'Unnamed screencast', [], null)

export default {
  components: {
    ElicastEditor,
    LoadSaveModal
  },

  data () {
    return {
      currentEditor: { template: '<div>Loading...</div>' },
      displayLoadSaveButton: false
    }
  },

  async mounted (t) {
    if (this.$query.id) {
      const elicast = await ElicastService.loadElicast(this.$query.id)
      this.reloadElicast(elicast)
      this.displayLoadSaveButton = false
    } else {
      this.reloadElicast(INIT_ELICAST)
      this.displayLoadSaveButton = true
    }
  },

  methods: {
    showLoadSaveModal () {
      const currentElicast = this.$refs.editorPlaceholder.getCurrentElicast()
      _.defer(() => this.$refs.loadSaveModal.open(currentElicast))
    },
    reloadElicast (newElicast) {
      const newElicastEditor = {
        data () {
          return {
            elicast: newElicast
          }
        },
        methods: {
          getCurrentElicast () {
            return this.$refs.elicastEditor.currentElicast
          }
        },
        template: '<ElicastEditor ref="elicastEditor" :elicast="elicast"></ElicastEditor>',
        components: {
          ElicastEditor
        }
      }
      this.currentEditor = newElicastEditor
    },
    handleSaveButtonClick () {
      const currentElicast = this.$refs.editorPlaceholder.getCurrentElicast()
      ElicastService.updateElicast(currentElicast.id, currentElicast)
    },
    loadSaveModalElicastLoaded (elicast) {
      this.reloadElicast(elicast)
    },
    loadSaveModalElicastSaved (elicast) {
      this.reloadElicast(elicast)
    }
  }
}
</script>

<style lang="scss">

h5 {
  margin: .5rem 0;
  font-family: 'Avenir';
}

.top-controls {
  float: right;
  padding-bottom: 0.1rem;

  button {
    cursor: pointer;
  }
}

</style>
