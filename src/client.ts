// HTTP client para la API de Tienda Nube / Nuvemshop con rate limiting y retry.
//
// Notas de la API:
// - Header de auth v1: "Authentication: bearer <token>" (OJO: NO "Authorization")
// - Header de auth 2025-03: "Authorization: Bearer <token>" (según docs nuevas)
//   => mandamos AMBOS headers siempre; el endpoint usa el que corresponda.
// - User-Agent obligatorio con email de contacto: "MyApp (contact@example.com)"
// - Base URL v1:      https://api.tiendanube.com/v1/{store_id}/
// - Base URL 2025-03: https://api.tiendanube.com/2025-03/{store_id}/  (páginas y blog viven acá)
// - Rate limit: varía por plan. Aplicamos retry con backoff ante 429.

import { getAccessToken, getStoreId, getUserAgent } from './auth.js'
import type { TNError } from './types.js'

const TN_API_BASE_V1 = 'https://api.tiendanube.com/v1'
const TN_API_BASE_2025_03 = 'https://api.tiendanube.com/2025-03'
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

// Versión de la API. 'v1' es el default histórico; '2025-03' se usa para páginas y blog.
export type TNApiVersion = 'v1' | '2025-03'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  // body puede ser JSON (objeto/array) o FormData (multipart, requerido por el blog).
  body?: Record<string, unknown> | unknown[] | FormData
  params?: Record<string, string | number | boolean | undefined>
  apiVersion?: TNApiVersion
  // Si la API responde 404 en un GET de listado (TN devuelve 404 cuando un filtro
  // no matchea ningun recurso, ej: /orders sin resultados), devolver [] en vez de tirar error.
  emptyArrayOn404?: boolean
}

export interface TNResponse<T> {
  data: T
  totalCount?: number
  linkHeader?: string | null
}

export async function tnFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { data } = await tnFetchWithMeta<T>(path, options)
  return data
}

export async function tnFetchWithMeta<T>(
  path: string,
  options: RequestOptions = {}
): Promise<TNResponse<T>> {
  const { method = 'GET', body, params, apiVersion = 'v1', emptyArrayOn404 = false } = options
  const storeId = getStoreId()

  // Construir URL según la versión de API
  const base = apiVersion === '2025-03' ? TN_API_BASE_2025_03 : TN_API_BASE_V1
  let url = `${base}/${storeId}${path}`
  if (params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value))
      }
    }
    const qs = searchParams.toString()
    if (qs) url += `?${qs}`
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const token = getAccessToken()

      // Detectar multipart: si el body es FormData, fetch setea el Content-Type
      // (con boundary) automáticamente, así que NO lo definimos a mano.
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

      const headers: Record<string, string> = {
        Authentication: `bearer ${token}`, // v1
        Authorization: `Bearer ${token}`, // 2025-03
        'User-Agent': getUserAgent(),
      }
      if (body !== undefined && !isFormData) {
        headers['Content-Type'] = 'application/json'
      }

      const response = await fetch(url, {
        method,
        headers,
        ...(body !== undefined
          ? { body: isFormData ? (body as FormData) : JSON.stringify(body) }
          : {}),
      })

      // Rate limit: respetar X-Rate-Limit-Reset si está presente, sino backoff
      if (response.status === 429) {
        const reset = response.headers.get('x-rate-limit-reset')
        const waitMs = reset ? parseInt(reset) : RETRY_DELAY_MS * (attempt + 1)
        console.error(`[tn-mcp] Rate limited. Esperando ${waitMs}ms...`)
        await sleep(waitMs)
        continue
      }

      if (!response.ok) {
        // TN devuelve 404 en list endpoints cuando el filtro no matchea nada
        // (ej: GET /orders?payment_status=pending sin ordenes pendientes).
        // En ese caso devolvemos una lista vacia en vez de tirar error.
        if (response.status === 404 && emptyArrayOn404) {
          return { data: [] as unknown as T, totalCount: 0, linkHeader: null }
        }
        const errorData = await response.json().catch(() => null) as TNError | null
        const msg = formatTNError(errorData) || `HTTP ${response.status}`
        throw new Error(`Error API TN: ${msg} [${method} ${path}]`)
      }

      // Algunas respuestas (POST /orders/{id}/close) pueden devolver body vacío
      const totalCount = response.headers.get('x-total-count')
      const linkHeader = response.headers.get('link')
      const text = await response.text()
      const data = text ? (JSON.parse(text) as T) : (undefined as unknown as T)

      return {
        data,
        totalCount: totalCount ? parseInt(totalCount) : undefined,
        linkHeader,
      }
    } catch (error) {
      lastError = error as Error
      if (attempt < MAX_RETRIES && isRetryable(error as Error)) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      throw error
    }
  }

  throw lastError || new Error('Error inesperado en tnFetch')
}

function formatTNError(err: TNError | null): string | null {
  if (!err) return null

  const parts: string[] = []

  if (typeof err.message === 'string') {
    parts.push(err.message)
  } else if (err.message && typeof err.message === 'object') {
    // TN devuelve errores de validación como { field: ["msg1", "msg2"] }
    parts.push(
      Object.entries(err.message)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join(' | ')
    )
  }

  // `message` suele ser genérico ("Unprocessable Entity"); el motivo real viene
  // en `description` o como errores de validación al nivel raíz del objeto,
  // ej: { "name": ["can't be blank"] }. Antes se descartaban.
  if (err.description) parts.push(err.description)

  const RESERVED = new Set(['code', 'message', 'description', 'error'])
  const fieldErrors = Object.entries(err as unknown as Record<string, unknown>)
    .filter(([key, value]) => !RESERVED.has(key) && Array.isArray(value))
    .map(([field, msgs]) => `${field}: ${(msgs as unknown[]).join(', ')}`)
  if (fieldErrors.length) parts.push(fieldErrors.join(' | '))

  return parts.length ? parts.join(' — ') : null
}

function isRetryable(error: Error): boolean {
  const msg = error.message.toLowerCase()
  return (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('timeout')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Helper: escoger el primer valor de un objeto multilenguaje (TN devuelve { es, pt, en })
export function pickLocalized(
  value: Record<string, string> | string | null | undefined,
  preferredLang = 'es'
): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value[preferredLang]) return value[preferredLang]
  const firstKey = Object.keys(value)[0]
  return firstKey ? value[firstKey] : ''
}
