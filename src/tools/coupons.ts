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

export function registerGetCoupon(server: McpServer) {
  server.registerTool(
    'get_coupon',
    {
      description: 'Obtiene un cupón de descuento por ID. Devuelve código, tipo, valor, validez, usos y fechas de vigencia.',
      inputSchema: {
        id: z.number().describe('ID del cupón.'),
      },
    },
    async ({ id }) => {
      const coupon = await tnFetch<TNCoupon>(`/coupons/${id}`)

      return {
        content: [{
          type: 'text' as const,
          text: `Cupón ${coupon.id}:\n\n${JSON.stringify({
            id: coupon.id,
            codigo: coupon.code,
            tipo: coupon.type,
            valor: coupon.value,
            valido: coupon.valid,
            usos: `${coupon.used}${coupon.max_uses ? `/${coupon.max_uses}` : ''}`,
            min_compra: coupon.min_price,
            inicio: coupon.start_date,
            fin: coupon.end_date,
            incluye_envio: coupon.includes_shipping,
            solo_primera_compra: coupon.first_consumer_purchase,
          }, null, 2)}`,
        }],
      }
    }
  )
}

export function registerUpdateCoupon(server: McpServer) {
  server.registerTool(
    'update_coupon',
    {
      description: 'Actualiza un cupón existente. Solo se envían los campos que se quieren modificar.',
      inputSchema: {
        id: z.number().describe('ID del cupón a actualizar.'),
        code: z.string().optional().describe('Nuevo código del cupón.'),
        type: z.enum(['percentage', 'absolute', 'shipping']).optional(),
        value: z.union([z.string(), z.number()]).optional().describe('Nuevo valor del descuento.'),
        valid: z.boolean().optional().describe('Activar o desactivar el cupón.'),
        start_date: z.string().optional().describe('Nueva fecha inicio (YYYY-MM-DD HH:MM:SS).'),
        end_date: z.string().optional().describe('Nueva fecha fin (YYYY-MM-DD HH:MM:SS).'),
        max_uses: z.number().optional().describe('Nuevo máximo de usos.'),
        min_price: z.number().optional().describe('Nueva compra mínima.'),
        includes_shipping: z.boolean().optional(),
        first_consumer_purchase: z.boolean().optional(),
        combines_with_other_discounts: z.boolean().optional(),
        categories: z.array(z.number()).optional(),
        products: z.array(z.number()).optional(),
      },
    },
    async ({ id, ...rest }) => {
      const body = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      )
      const coupon = await tnFetch<TNCoupon>(`/coupons/${id}`, {
        method: 'PUT',
        body,
      })
      return {
        content: [{
          type: 'text' as const,
          text: `Cupón ${coupon.id} actualizado:\n` +
            `  código:  ${coupon.code}\n` +
            `  tipo:    ${coupon.type}${coupon.value ? ` (${coupon.value})` : ''}\n` +
            `  válido:  ${coupon.valid}`,
        }],
      }
    }
  )
}

export function registerDeleteCoupon(server: McpServer) {
  server.registerTool(
    'delete_coupon',
    {
      description: 'Elimina un cupón de descuento por ID.',
      inputSchema: {
        id: z.number().describe('ID del cupón a eliminar.'),
      },
    },
    async ({ id }) => {
      await tnFetch<unknown>(`/coupons/${id}`, { method: 'DELETE' })
      return {
        content: [{ type: 'text' as const, text: `Cupón ${id} eliminado correctamente.` }],
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
