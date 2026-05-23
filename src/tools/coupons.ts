import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, tnFetchWithMeta } from '../client.js'
import type { TNCoupon } from '../types.js'

export function registerListCoupons(server: McpServer) {
  server.registerTool(
    'list_coupons',
    {
      description: 'Lista los cupones de descuento. Filtros por código, validez, tipo y rango de fechas de vigencia.',
      inputSchema: {
        q: z.string().optional().describe('Búsqueda por código.'),
        valid: z.boolean().optional().describe('Solo cupones válidos.'),
        discount_type: z.enum(['percentage', 'absolute', 'shipping']).optional(),
        includes_shipping: z.boolean().optional(),
        min_start_date: z.string().optional(),
        max_end_date: z.string().optional(),
        page: z.number().min(1).optional(),
        per_page: z.number().min(1).max(200).optional(),
      },
    },
    async (args) => {
      const { data: coupons, totalCount } = await tnFetchWithMeta<TNCoupon[]>(
        '/coupons',
        { params: args as Record<string, string | number | boolean | undefined> }
      )

      if (!coupons || coupons.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No se encontraron cupones.' }] }
      }

      const summary = coupons.map(c => ({
        id: c.id,
        codigo: c.code,
        tipo: c.type,
        valor: c.value,
        valido: c.valid,
        usos: `${c.used}${c.max_uses ? `/${c.max_uses}` : ''}`,
        min_compra: c.min_price,
        incluye_envio: c.includes_shipping,
        inicio: c.start_date,
        fin: c.end_date,
        solo_primera_compra: c.first_consumer_purchase,
      }))

      return {
        content: [{
          type: 'text' as const,
          text: `${summary.length} cupones${totalCount ? ` (de ${totalCount} total)` : ''}:\n\n` +
            JSON.stringify(summary, null, 2),
        }],
      }
    }
  )
}

export function registerCreateCoupon(server: McpServer) {
  server.registerTool(
    'create_coupon',
    {
      description: 'Crea un nuevo cupón de descuento. Para type=percentage o absolute es obligatorio `value`. Para type=shipping, `value` se ignora.',
      inputSchema: {
        code: z.string().describe('Código único (alfanumérico).'),
        type: z.enum(['percentage', 'absolute', 'shipping']).describe('percentage=% off, absolute=monto fijo, shipping=envío gratis.'),
        value: z.union([z.string(), z.number()]).optional().describe('Valor del descuento (requerido para percentage/absolute).'),
        valid: z.boolean().optional().describe('Activar inmediatamente (default true).'),
        start_date: z.string().optional().describe('Fecha inicio (YYYY-MM-DD HH:MM:SS).'),
        end_date: z.string().optional().describe('Fecha fin (YYYY-MM-DD HH:MM:SS).'),
        max_uses: z.number().optional().describe('Máximo de usos totales.'),
        min_price: z.number().optional().describe('Compra mínima para aplicar.'),
        includes_shipping: z.boolean().optional().describe('Si incluye el costo de envío en el descuento.'),
        first_consumer_purchase: z.boolean().optional().describe('Solo válido para primera compra.'),
        combines_with_other_discounts: z.boolean().optional().describe('Combinable con otros descuentos (default true).'),
        categories: z.array(z.number()).optional().describe('Aplica solo a estas categorías (excluyente con products).'),
        products: z.array(z.number()).optional().describe('Aplica solo a estos productos (excluyente con categories).'),
      },
    },
    async (args) => {
      if ((args.type === 'percentage' || args.type === 'absolute') && args.value === undefined) {
        throw new Error(`Para type="${args.type}" el campo "value" es obligatorio.`)
      }
      if (args.categories && args.products) {
        throw new Error('"categories" y "products" son mutuamente excluyentes; usá solo uno.')
      }

      const body = Object.fromEntries(
        Object.entries(args).filter(([, v]) => v !== undefined)
      )

      const coupon = await tnFetch<TNCoupon>('/coupons', {
        method: 'POST',
        body,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Cupón creado:\n` +
            `  id:      ${coupon.id}\n` +
            `  código:  ${coupon.code}\n` +
            `  tipo:    ${coupon.type}${coupon.value ? ` (${coupon.value})` : ''}\n` +
            `  válido:  ${coupon.valid}\n` +
            `  vigencia: ${coupon.start_date || '—'} → ${coupon.end_date || '—'}`,
        }],
      }
    }
  )
}
