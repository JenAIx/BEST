<template>
  <q-page class="page-size" data-cy="page_storage">
    <div class="column items-center" style="height: 100%">
      <!-- HEADING -->
      <div class="col-auto q-pt-md text-h6">{{ $t('storage.label') }}</div>
      <!-- CONTENT -->
      <div class="col full-width column items-center" style="min-height: 0">
        <StorageResponses />
      </div>
    </div>
    <BACKBUTTON />
  </q-page>
</template>

<script>
import BACKBUTTON from 'src/components/BackButton.vue'
import StorageResponses from 'src/components/StorageResponses.vue'

export default {
  name: 'PageStorage',
  components: { BACKBUTTON, StorageResponses },
}
</script>
