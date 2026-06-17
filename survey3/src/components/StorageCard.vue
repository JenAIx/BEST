<template>
  <q-card
    class="storage-card cursor-pointer"
    :class="{ 'storage-card--selected': checked }"
    flat
    bordered
    @click="view_item(index)"
  >
    <div class="storage-card__accent" :class="item.exported ? 'bg-green' : 'bg-warning'" />

    <q-card-section horizontal class="items-center no-wrap q-py-sm q-pl-sm q-pr-none">
      <!-- CHECKBOX -->
      <q-checkbox
        v-model="checked"
        @update:model-value="changeSel"
        :data-cy="'check_' + index"
        class="q-mr-xs"
        @click.stop
      />

      <!-- INFO -->
      <div class="col storage-card__info">
        <div class="row items-center q-gutter-x-xs">
          <span class="text-weight-medium text-body2 ellipsis">{{ item.cda.subject.display }}</span>
          <q-badge
            v-if="item.exported"
            color="green"
            text-color="white"
            rounded
            :data-cy="'exported_' + index"
          >{{ $t('storage.export_finished') }}</q-badge>
          <q-badge v-else color="warning" text-color="white" rounded>{{
            $t('storage.export_open')
          }}</q-badge>
        </div>
        <div class="text-caption text-grey-7 ellipsis q-mt-xs">
          {{ item.info.title }}
        </div>
        <div class="text-caption text-grey-5" style="font-size: 10px">
          {{ item.cda.date }}
        </div>
      </div>

      <!-- ACTIONS -->
      <div class="storage-card__actions q-mr-xs" @click.stop>
        <q-btn
          flat
          dense
          round
          icon="more_vert"
          color="grey-7"
          size="sm"
          data-cy="btn_options"
        >
          <q-menu cover auto-close>
            <q-list>
              <q-item clickable @click="export_item(index)" data-cy="back_root">
                <q-item-section avatar>
                  <q-icon :name="$t('btn.export.icon')" />
                </q-item-section>
                <q-item-section>{{ $t('btn.export.label') }}</q-item-section>
              </q-item>
              <q-item clickable @click="export_item_encrypted(index)" data-cy="back_root">
                <q-item-section avatar>
                  <q-icon :name="$t('btn.export.icon2')" />
                </q-item-section>
                <q-item-section>{{ $t('btn.export.label') }} ({{ $t('btn.export.encrypt') }})</q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable @click="remove(index)" data-cy="back_root" class="text-negative">
                <q-item-section avatar>
                  <q-icon :name="$t('btn.delete.icon')" color="negative" />
                </q-item-section>
                <q-item-section>{{ $t('btn.delete.label') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
    </q-card-section>
  </q-card>
</template>

<script>
export default {
  props: ["index", "item", "selected"],
  name: "StorageCard",
  data() {
    return {
      checked: false,
    };
  },
  watch: {
    selected(val) {
      if (val !== this.checked) this.checked = val;
    },
  },

  methods: {
    changeSel(val) {
      this.$emit("change_selection", val);
    },
    export_item(index) {
      this.$emit("export_item", index);
    },
    export_item_encrypted(index) {
      this.$emit("export_item_encrypted", index);
    },
    remove(index) {
      this.$emit("remove", index);
    },
    view_item(index) {
      this.$emit("view_item", index);
    },
  },
};
</script>

<style lang="sass" scoped>
.storage-card
  width: 340px
  border-radius: $radius-sm
  overflow: hidden
  position: relative
  transition: box-shadow 0.2s ease, transform 0.15s ease
  background: $surface
  border-color: $line

  &:hover
    box-shadow: $shadow-hover
    transform: translateY(-1px)

  &--selected
    background: $surface-muted
    border-color: $primary

.storage-card__accent
  position: absolute
  left: 0
  top: 0
  bottom: 0
  width: 4px

.storage-card__info
  min-width: 0
  padding-right: 4px

.storage-card__actions
  display: flex
  flex-direction: column
  align-items: center
  gap: 2px
</style>
