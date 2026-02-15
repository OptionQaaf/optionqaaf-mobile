export const FYP_DEBUG = __DEV__ && true

type PanelStore = {
  gridRankTop15: unknown[] | null
  reelSimilarityTop10: unknown[] | null
  profileTopSignals: Record<string, unknown> | null
  reelRetrievalCounts: Record<string, unknown> | null
  rawProductPayloads: { source: string; handle: string; at: string; payload: unknown }[]
}

const panelStore: PanelStore = {
  gridRankTop15: null,
  reelSimilarityTop10: null,
  profileTopSignals: null,
  reelRetrievalCounts: null,
  rawProductPayloads: [],
}

const lastSignatureByKey = new Map<string, string>()
const sampledHandlesByKey = new Set<string>()

function serialize(input: unknown): string {
  try {
    return JSON.stringify(input) ?? ""
  } catch {
    return String(input)
  }
}

export function fypLog(label: string, payload?: unknown) {
  if (!FYP_DEBUG) return
  console.groupCollapsed(`[FYP_DEBUG] ${label}`)
  if (payload !== undefined) console.log(payload)
  console.groupEnd()
}

export function fypTable(label: string, rows: unknown[]) {
  if (!FYP_DEBUG) return
  if (!Array.isArray(rows) || !rows.length) return
  console.groupCollapsed(`[FYP_TABLE] ${label}`)
  console.table(rows)
  console.groupEnd()
}

export function fypTableOnce(key: string, label: string, rows: unknown[]) {
  if (!FYP_DEBUG) return
  const signature = serialize(rows)
  const previous = lastSignatureByKey.get(key)
  if (previous === signature) return
  lastSignatureByKey.set(key, signature)
  fypTable(label, rows)
}

export function fypLogOnce(key: string, label: string, payload?: unknown) {
  if (!FYP_DEBUG) return
  const signature = serialize(payload)
  const previous = lastSignatureByKey.get(key)
  if (previous === signature) return
  lastSignatureByKey.set(key, signature)
  fypLog(label, payload)
}

export function fypSampleOncePerHandle(key: string, handle: string, label: string, payload?: unknown) {
  if (!FYP_DEBUG) return
  const normalized = `${key}:${String(handle || "")
    .trim()
    .toLowerCase()}`
  if (sampledHandlesByKey.has(normalized)) return
  sampledHandlesByKey.add(normalized)
  fypLog(label, payload)
}

export function setFypDebugPanelEntry<K extends keyof PanelStore>(key: K, value: PanelStore[K]) {
  if (!FYP_DEBUG) return
  panelStore[key] = value
}

export function addFypDebugProductPayload(source: string, handle: string, payload: unknown) {
  if (!FYP_DEBUG) return
  const normalizedSource = String(source ?? "").trim()
  const normalizedHandle = String(handle ?? "").trim()
  if (!normalizedSource || !normalizedHandle || payload == null) return
  const signature = `${normalizedSource}|${normalizedHandle}|${serialize(payload)}`
  const previous = lastSignatureByKey.get(`RAW_PRODUCT_PAYLOAD:${normalizedSource}:${normalizedHandle}`)
  if (previous === signature) return
  lastSignatureByKey.set(`RAW_PRODUCT_PAYLOAD:${normalizedSource}:${normalizedHandle}`, signature)

  panelStore.rawProductPayloads = [
    { source: normalizedSource, handle: normalizedHandle, at: new Date().toISOString(), payload },
    ...panelStore.rawProductPayloads,
  ].slice(0, 10)
}

export function getFypDebugPanelState(): PanelStore {
  return { ...panelStore, rawProductPayloads: [...panelStore.rawProductPayloads] }
}

export function summarizeProductPayload(products: any[]): {
  total: number
  sampleHandles: string[]
  percentProductTypeEmpty: number
  avgTagCount: number
  avgDescriptionLength: number
  avgImageCount: number
  percentImagesWithAlt: number
} {
  const total = products.length
  if (!total) {
    return {
      total: 0,
      sampleHandles: [],
      percentProductTypeEmpty: 0,
      avgTagCount: 0,
      avgDescriptionLength: 0,
      avgImageCount: 0,
      percentImagesWithAlt: 0,
    }
  }

  let productTypeEmpty = 0
  let totalTags = 0
  let totalDescription = 0
  let totalImages = 0
  let totalImagesWithAlt = 0
  for (const product of products) {
    if (!String(product?.productType ?? "").trim()) productTypeEmpty += 1
    const tags = Array.isArray(product?.tags) ? product.tags : []
    totalTags += tags.length
    totalDescription += String(product?.description ?? product?.descriptionHtml ?? "").length
    const images = [
      ...(Array.isArray(product?.images?.nodes) ? product.images.nodes : []),
      ...(product?.featuredImage ? [product.featuredImage] : []),
    ].filter(Boolean)
    totalImages += images.length
    totalImagesWithAlt += images.filter((image: any) => Boolean(String(image?.altText ?? "").trim())).length
  }
  return {
    total,
    sampleHandles: products.slice(0, 3).map((product) => String(product?.handle ?? "")),
    percentProductTypeEmpty: Number(((productTypeEmpty / total) * 100).toFixed(2)),
    avgTagCount: Number((totalTags / total).toFixed(2)),
    avgDescriptionLength: Number((totalDescription / total).toFixed(2)),
    avgImageCount: Number((totalImages / total).toFixed(2)),
    percentImagesWithAlt: Number(((totalImagesWithAlt / Math.max(1, totalImages)) * 100).toFixed(2)),
  }
}
