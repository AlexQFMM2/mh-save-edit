// Keep review metadata in the catalog; present only the translation source to users.
const sourceLabels: Record<string, string> = {
  '项目译名（待验收）': '项目译名',
  '项目译文（待验收）': '项目译文',
  '日版原文（中文待审校）': '日版原文',
}

export const itemTranslationSourceLabel = (source: string) => sourceLabels[source] ?? source
