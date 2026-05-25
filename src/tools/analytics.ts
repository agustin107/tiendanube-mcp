import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetchWithMeta, pickLocalized } from '../client.js'
import type { TNOrder, TNVariant } from '../types.js'

async function fetchAllPages<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const results: T[] = []
  let page = 1
  while (true) {
    const { data, linkHeader } = await tnFetchWithMeta<T[]>(path, {
      params: { ...params, page: String(page), per_page: '50' },
    })
    if (data) results.push(...data)
    if (!linkHeader?.includes('rel="next"')) break
    page++
  }
  return results
}

function isoFromDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export function registerGetRevenueSummary(server: McpServer) {
  server.registerTool(
    'get_revenue_summary',
    {
      description: 'Resumen de ingresos: total, promedio por pedido y cantidad de órdenes en los últimos N días. Considera solo órdenes con pago completado.',
      inputSchema: {
        days: z.number().min(1).max(365).optional().describe('Días hacia atrás desde hoy (default: 30).'),
        payment_status: z.string().optional().describe('Filtrar por estado de pago (default: "paid"). Ej: paid, pending, authorized.'),
      },
    },
    async ({ days = 30, payment_status = 'paid' }) => {
      const since = isoFromDaysAgo(days)
      const orders = await fetchAllPages<TNOrder>('/orders', {
        created_at_min: since,
        payment_status,
      })

      if (orders.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `Sin órdenes ${payment_status} en los últimos ${days} días.`,
          }],
        }
      }

      const currency = orders[0].currency
      const total = orders.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0)
      const avg = total / orders.length

      return {
        content: [{
          type: 'text' as const,
          text: [
            `Resumen de ingresos — últimos ${days} días (estado: ${payment_status})`,
            ``,
            `  Ingresos totales:    ${currency} ${total.toFixed(2)}`,
            `  Órdenes:            ${orders.length}`,
            `  Promedio por orden: ${currency} ${avg.toFixed(2)}`,
            `  Período:            desde ${since.slice(0, 10)} hasta hoy`,
          ].join('\n'),
        }],
      }
    }
  )
}

export function registerGetSalesByPeriod(server: McpServer) {
  server.registerTool(
    'get_sales_by_period',
    {
      description: 'Ingresos y cantidad de órdenes agrupados por día para un rango de fechas. Útil para ver tendencias.',
      inputSchema: {
        from: z.string().describe('Fecha inicio en formato YYYY-MM-DD.'),
        to: z.string().describe('Fecha fin en formato YYYY-MM-DD.'),
        payment_status: z.string().optional().describe('Estado de pago a considerar (default: "paid").'),
      },
    },
    async ({ from, to, payment_status = 'paid' }) => {
      const orders = await fetchAllPages<TNOrder>('/orders', {
        created_at_min: `${from}T00:00:00Z`,
        created_at_max: `${to}T23:59:59Z`,
        payment_status,
      })

      const byDay: Record<string, { revenue: number; count: number }> = {}
      for (const order of orders) {
        const day = order.created_at.slice(0, 10)
        if (!byDay[day]) byDay[day] = { revenue: 0, count: 0 }
        byDay[day].revenue += parseFloat(order.total || '0')
        byDay[day].count++
      }

      const currency = orders[0]?.currency ?? ''
      const rows = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, { revenue, count }]) =>
          `  ${date}  ${currency} ${revenue.toFixed(2).padStart(12)}  ${String(count).padStart(6)} órdenes`
        )

      const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total || '0'), 0)

      return {
        content: [{
          type: 'text' as const,
          text: [
            `Ventas por día — ${from} al ${to} (${payment_status})`,
            ``,
            `  Fecha          Ingresos     Órdenes`,
            `  ${'─'.repeat(42)}`,
            ...rows,
            `  ${'─'.repeat(42)}`,
            `  TOTAL          ${currency} ${totalRevenue.toFixed(2).padStart(12)}  ${String(orders.length).padStart(6)} órdenes`,
          ].join('\n'),
        }],
      }
    }
  )
}

export function registerGetBestSellingProducts(server: McpServer) {
  server.registerTool(
    'get_best_selling_products',
    {
      description: 'Top N productos más vendidos por unidades, calculado desde las órdenes pagadas de los últimos N días.',
      inputSchema: {
        days: z.number().min(1).max(365).optional().describe('Días hacia atrás (default: 30).'),
        limit: z.number().min(1).max(50).optional().describe('Cuántos productos devolver (default: 10).'),
      },
    },
    async ({ days = 30, limit = 10 }) => {
      const since = isoFromDaysAgo(days)
      const orders = await fetchAllPages<TNOrder>('/orders', {
        created_at_min: since,
        payment_status: 'paid',
      })

      const byProduct: Record<number, { name: string; units: number; revenue: number; currency: string }> = {}

      for (const order of orders) {
        for (const item of order.products ?? []) {
          if (!byProduct[item.product_id]) {
            byProduct[item.product_id] = {
              name: item.name,
              units: 0,
              revenue: 0,
              currency: order.currency,
            }
          }
          byProduct[item.product_id].units += item.quantity
          byProduct[item.product_id].revenue += parseFloat(item.price) * item.quantity
        }
      }

      const ranked = Object.entries(byProduct)
        .sort(([, a], [, b]) => b.units - a.units)
        .slice(0, limit)

      if (ranked.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `Sin ventas pagadas en los últimos ${days} días.` }],
        }
      }

      const rows = ranked.map(([id, { name, units, revenue, currency }], i) =>
        `  ${String(i + 1).padStart(2)}. [${id}] ${name.slice(0, 40).padEnd(40)}  ${String(units).padStart(6)} uds  ${currency} ${revenue.toFixed(2).padStart(10)}`
      )

      return {
        content: [{
          type: 'text' as const,
          text: [
            `Top ${ranked.length} productos — últimos ${days} días`,
            ``,
            `   #   ID   Producto                                   Unidades    Ingresos`,
            `  ${'─'.repeat(72)}`,
            ...rows,
          ].join('\n'),
        }],
      }
    }
  )
}

export function registerGetOrdersDashboard(server: McpServer) {
  server.registerTool(
    'get_orders_dashboard',
    {
      description: 'Snapshot de órdenes agrupadas por estado de pago y estado de envío. Útil para ver qué requiere atención.',
      inputSchema: {
        days: z.number().min(1).max(365).optional().describe('Considerar solo órdenes de los últimos N días. Si se omite, trae todas las abiertas.'),
      },
    },
    async ({ days }) => {
      const params: Record<string, string> = { status: 'open' }
      if (days) params.created_at_min = isoFromDaysAgo(days)

      const orders = await fetchAllPages<TNOrder>('/orders', params)

      const byPayment: Record<string, number> = {}
      const byShipping: Record<string, number> = {}

      for (const order of orders) {
        const ps = order.payment_status ?? 'unknown'
        const ss = order.shipping_status ?? 'unknown'
        byPayment[ps] = (byPayment[ps] ?? 0) + 1
        byShipping[ss] = (byShipping[ss] ?? 0) + 1
      }

      const payRows = Object.entries(byPayment)
        .sort(([, a], [, b]) => b - a)
        .map(([status, count]) => `  ${status.padEnd(20)} ${count}`)

      const shipRows = Object.entries(byShipping)
        .sort(([, a], [, b]) => b - a)
        .map(([status, count]) => `  ${status.padEnd(20)} ${count}`)

      return {
        content: [{
          type: 'text' as const,
          text: [
            `Dashboard de órdenes${days ? ` — últimos ${days} días` : ' (todas las abiertas)'}`,
            `Total: ${orders.length} órdenes`,
            ``,
            `Estado de pago:`,
            ...payRows,
            ``,
            `Estado de envío:`,
            ...shipRows,
          ].join('\n'),
        }],
      }
    }
  )
}

export function registerGetInventoryAlerts(server: McpServer) {
  server.registerTool(
    'get_inventory_alerts',
    {
      description: 'Lista variantes con stock igual o menor al umbral indicado. Excluye variantes con stock ilimitado (null). Útil para detectar quiebres de stock.',
      inputSchema: {
        threshold: z.number().min(0).optional().describe('Umbral de stock bajo (default: 5). Incluye variantes con stock <= threshold.'),
      },
    },
    async ({ threshold = 5 }) => {
      const products = await fetchAllPages<{ id: number; name: Record<string, string>; variants: TNVariant[] }>(
        '/products',
        { published: 'true' }
      )

      const alerts: Array<{
        product_id: number
        product_name: string
        variant_id: number
        sku: string | null
        values: string
        stock: number
      }> = []

      for (const product of products) {
        const name = pickLocalized(product.name)
        for (const variant of product.variants ?? []) {
          if (
            variant.stock_management &&
            variant.stock !== null &&
            variant.stock <= threshold
          ) {
            alerts.push({
              product_id: product.id,
              product_name: name,
              variant_id: variant.id,
              sku: variant.sku,
              values: (variant.values ?? []).map(v => pickLocalized(v)).filter(Boolean).join(' / ') || 'default',
              stock: variant.stock,
            })
          }
        }
      }

      alerts.sort((a, b) => a.stock - b.stock)

      if (alerts.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `Sin alertas de stock: ninguna variante tiene stock <= ${threshold}.`,
          }],
        }
      }

      const rows = alerts.map(a =>
        `  [P:${a.product_id} V:${a.variant_id}] ${a.product_name.slice(0, 30).padEnd(30)}  ${a.values.slice(0, 20).padEnd(20)}  SKU: ${(a.sku ?? '-').padEnd(12)}  Stock: ${a.stock}`
      )

      return {
        content: [{
          type: 'text' as const,
          text: [
            `Alertas de stock bajo (umbral: ${threshold}) — ${alerts.length} variantes`,
            ``,
            ...rows,
          ].join('\n'),
        }],
      }
    }
  )
}

export function registerGetPendingPayments(server: McpServer) {
  server.registerTool(
    'get_pending_payments',
    {
      description: 'Órdenes con pago pendiente más antiguas que N horas. Útil para hacer seguimiento de pagos no completados.',
      inputSchema: {
        hours: z.number().min(1).optional().describe('Horas de antigüedad mínima (default: 24).'),
        limit: z.number().min(1).max(100).optional().describe('Máximo de órdenes a devolver (default: 20).'),
      },
    },
    async ({ hours = 24, limit = 20 }) => {
      const cutoff = new Date()
      cutoff.setHours(cutoff.getHours() - hours)

      const orders = await fetchAllPages<TNOrder>('/orders', {
        payment_status: 'pending',
        status: 'open',
        created_at_max: cutoff.toISOString(),
      })

      if (orders.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `Sin pagos pendientes con más de ${hours}hs de antigüedad.`,
          }],
        }
      }

      const shown = orders.slice(0, limit)
      const rows = shown.map(o => {
        const ageHours = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 3600000)
        return `  #${o.number} [${o.id}]  ${o.currency} ${o.total.padStart(10)}  ${ageHours}hs  ${o.contact_email ?? '-'}`
      })

      return {
        content: [{
          type: 'text' as const,
          text: [
            `Pagos pendientes > ${hours}hs — ${orders.length} órdenes${orders.length > limit ? ` (mostrando ${limit})` : ''}`,
            ``,
            `  Orden          Total        Antigüedad  Email`,
            `  ${'─'.repeat(60)}`,
            ...rows,
          ].join('\n'),
        }],
      }
    }
  )
}
