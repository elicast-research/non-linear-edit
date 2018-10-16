import Vue from 'vue'
import fontawesome from '@fortawesome/fontawesome'
import FontAwesomeIcon from '@fortawesome/vue-fontawesome'
import solid from '@fortawesome/fontawesome-free-solid'

import ElicastEditorMain from './EditorMain'
import QueryPlugin from './plugin/query'
import LoggerPlugin from './plugin/logger'

import './assets/main.scss'

fontawesome.library.add(solid)
Vue.component('font-awesome-icon', FontAwesomeIcon)

Vue.use(QueryPlugin)
Vue.use(LoggerPlugin)

Vue.config.productionTip = false

/* eslint-disable no-new */
new Vue({
  el: '#editor_main',
  template: '<ElicastEditorMain/>',
  components: { ElicastEditorMain }
})
