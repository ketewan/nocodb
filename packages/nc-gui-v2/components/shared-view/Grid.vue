<script setup lang="ts">
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk'

import { ActiveViewInj, FieldsInj, IsPublicInj, MetaInj, ReadonlyInj, ReloadViewDataHookInj } from '~/context'

const { sharedView, meta, sorts, nestedFilters } = useSharedView()

const reloadEventHook = createEventHook<void>()
provide(ReloadViewDataHookInj, reloadEventHook)
provide(ReadonlyInj, true)
provide(MetaInj, meta)
provide(ActiveViewInj, sharedView)
provide(FieldsInj, ref(meta.value.columns as any[]))
provide(IsPublicInj, ref(true))

useProvideSmartsheetStore(sharedView as Ref<TableType>, meta, true, sorts, nestedFilters)
</script>

<template>
  <div class="nc-container flex flex-col h-full mt-1.5 px-12">
    <SmartsheetToolbar />
    <SmartsheetGrid />
  </div>
</template>

<style scoped>
.nc-container {
  height: 100%;
  padding-bottom: 0.5rem;
  flex: 1 1 100%;
}
</style>
