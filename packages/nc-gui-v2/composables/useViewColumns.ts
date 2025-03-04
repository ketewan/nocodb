import { isSystemColumn } from 'nocodb-sdk'
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import { watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useNuxtApp } from '#app'
import { IsPublicInj } from '#imports'
import type { Field } from '~/lib'

export function useViewColumns(view: Ref<ViewType> | undefined, meta: ComputedRef<TableType>, reloadData?: () => void) {
  const isPublic = inject(IsPublicInj, ref(false))

  const fields = ref<Field[]>()

  const filterQuery = ref('')

  const { $api } = useNuxtApp()

  const { isUIAllowed } = useUIPermission()

  const { isSharedBase } = useProject()

  const isLocalMode = computed(
    () => isPublic.value || !isUIAllowed('hideAllColumns') || !isUIAllowed('showAllColumns') || isSharedBase.value,
  )

  const metaColumnById = computed<Record<string, ColumnType>>(() => {
    if (!meta.value?.columns) return {}

    return meta.value?.columns?.reduce(
      (acc: ColumnType, curr: ColumnType) => ({
        ...acc,
        [curr.id!]: curr,
      }),
      {} as any,
    )
  })

  const loadViewColumns = async () => {
    if (!meta || !view) return

    let order = 1

    if (view.value?.id) {
      const data = (isPublic.value ? meta.value?.columns : await $api.dbViewColumn.list(view.value.id)) as any[]

      const fieldById = data.reduce<Record<string, any>>((acc, curr) => {
        curr.show = !!curr.show

        return {
          ...acc,
          [curr.fk_column_id]: curr,
        }
      }, {})

      fields.value = meta.value?.columns
        ?.map((column: ColumnType) => {
          const currentColumnField = fieldById[column.id!] || {}

          return {
            title: column.title,
            fk_column_id: column.id,
            ...currentColumnField,
            order: currentColumnField.order || order++,
            system: isSystemColumn(metaColumnById?.value?.[currentColumnField.fk_column_id!]),
          }
        })
        .sort((a: Field, b: Field) => a.order - b.order)
    }
  }

  const showAll = async (ignoreIds?: any) => {
    if (isLocalMode.value) {
      fields.value = fields.value?.map((field: Field) => ({
        ...field,
        show: true,
      }))
      reloadData?.()
      return
    }

    if (view?.value?.id) {
      if (ignoreIds) {
        await $api.dbView.showAllColumn(view.value.id, {
          ignoreIds,
        })
      } else {
        await $api.dbView.showAllColumn(view.value.id)
      }
    }

    await loadViewColumns()
    reloadData?.()
  }
  const hideAll = async (ignoreIds?: any) => {
    if (isLocalMode.value) {
      fields.value = fields.value?.map((field: Field) => ({
        ...field,
        show: false,
      }))
      reloadData?.()
      return
    }
    if (view?.value?.id) {
      if (ignoreIds) {
        await $api.dbView.hideAllColumn(view.value.id, {
          ignoreIds,
        })
      } else {
        await $api.dbView.hideAllColumn(view.value.id)
      }
    }

    await loadViewColumns()
    reloadData?.()
  }

  const saveOrUpdate = async (field: any, index: number) => {
    if (isPublic.value && fields.value) {
      fields.value[index] = field
      meta.value.columns = meta.value?.columns?.map((column: ColumnType) => {
        if (column.id === field.fk_column_id) {
          return {
            ...column,
            ...field,
          }
        }
        return column
      })

      reloadData?.()
      return
    }

    if (isUIAllowed('fieldsSync')) {
      if (field.id && view?.value?.id) {
        await $api.dbViewColumn.update(view.value.id, field.id, field)
      } else if (view?.value?.id) {
        if (fields.value) fields.value[index] = (await $api.dbViewColumn.create(view.value.id, field)) as any
      }
    }

    reloadData?.()
  }

  const showSystemFields = computed({
    get() {
      // todo: show_system_fields missing from ViewType
      return (view?.value as any)?.show_system_fields || false
    },
    set(v: boolean) {
      if (view?.value?.id) {
        if (!isLocalMode.value) {
          $api.dbView
            .update(view.value.id, {
              show_system_fields: v,
            })
            .finally(() => reloadData?.())
        }
        ;(view.value as any).show_system_fields = v
      }
    },
  })

  const filteredFieldList = computed(() => {
    return (
      fields.value?.filter((field: Field) => {
        // hide system columns if not enabled
        if (!showSystemFields.value && isSystemColumn(metaColumnById?.value?.[field.fk_column_id!])) {
          return false
        }

        if (filterQuery.value === '') {
          return true
        } else {
          return field.title.toLowerCase().includes(filterQuery.value.toLowerCase())
        }
      }) || []
    )
  })

  const sortedAndFilteredFields = computed<ColumnType[]>(() => {
    return (fields?.value
      ?.filter((field: Field) => {
        // hide system columns if not enabled
        if (
          !showSystemFields.value &&
          metaColumnById.value &&
          metaColumnById?.value?.[field.fk_column_id!] &&
          isSystemColumn(metaColumnById.value?.[field.fk_column_id!])
        ) {
          return false
        }
        return field.show && metaColumnById?.value?.[field.fk_column_id!]
      })
      ?.sort((a: Field, b: Field) => a.order - b.order)
      ?.map((field: Field) => metaColumnById?.value?.[field.fk_column_id!]) || []) as ColumnType[]
  })

  // reload view columns when table meta changes
  watch(meta, () => loadViewColumns())

  return {
    fields,
    loadViewColumns,
    filteredFieldList,
    filterQuery,
    showAll,
    hideAll,
    saveOrUpdate,
    sortedAndFilteredFields,
    showSystemFields,
    metaColumnById,
  }
}
