import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, tnFetchWithMeta } from '../client.js'
import type { TNOrder } from '../types.js'

export function registerListOrders(server: McpServer) {
  server.registerTool(
    'list_orders',
    {
      description: 'Lista órdenes con filtros por status, payment_status, shipping_status y rango de fecha/total. Soporta paginación (per_page máx 200, default 30).',
      inputSchema: {
        status: z.enum(['any', 'open', 'closed', 'cancelled']).optional().describe('Estado de la orden (default "any").'),
        payment_status: z.enum(['any', 'pending', 'authorized', 'paid', 'abandoned', 'refunded', 'voided']).optional(),
        shipping_status: z.enum(['any', 'unpacked', 'unfulfilled', 'fulfilled']).optional(),
        created_at_min: z.string().optional().describe('Fecha creación desde (ISO 8601).'),
        created_at_max: z.string().optional().describe('Fecha creación hasta (ISO 8601).'),
        updated_at_min: z.string().optional().describe('Última actualización desde (ISO 8601).'),
        total_min: z.number().optional(),
        total_max: z.number().optional(),
        channels: z.enum(['form', 'store', 'api', 'meli', 'pos']).optional().describe('Canal de origen.'),
        customer_ids: z.string().optional().describe('IDs de clientes separados por coma.'),
        page: z.number().min(1).optional(),
        per_page: z.number().min(1).max(200).optional(),
      },
    },
    async (args) => {
      const { data: orders, totalCount } = await tnFetchWithMeta<TNOrder[]>(
        '/orders',
        { params: args as Record<string, string | number | boolean | undefined> }
      )

      if (!orders || orders.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No se encontraron órdenes con los filtros indicados.' }] }
      }

      const summary = orders.map(o => ({
        id: o.id,
        numero: o.number,
        estado: o.status,
        pago: o.payment_status,
        envio: o.shipping_status,
        total: `${o.currency} ${o.total}`,
        cliente: o.customer?.name || o.contact_email || '—',
        items: (o.products ?? []).map(p => `${p.quantity}× ${p.name}${p.sku ? ` (${p.sku})` : ''}`),
        creada: o.created_at,
      }))

      return {
        content: [{
          type: 'text' as const,
          text: `${summary.length} órdenes${totalCount ? ` (de ${totalCount} total)` : ''}:\n\n` +
            JSON.stringify(summary, null, 2),
        }],
      }
    }
  )
}

export function registerGetOrder(server: McpServer) {
  server.registerTool(
    'get_order',
    {
      description: 'Obtiene una orden completa por id. Incluye cliente, items, envío, tracking y totales.',
      inputSchema: {
        id: z.number().describe('ID de la orden.'),
      },
    },
    async ({ id }) => {
      const order = await tnFetch<TNOrder>(`/orders/${id}`)

      const detail = {
        id: order.id,
        numero: order.number,
        token: order.token,
        estado: order.status,
        pago: order.payment_status,
        envio: order.shipping_status,
        subtotal: order.subtotal,
        descuento: order.discount,
        total: `${order.currency} ${order.total}`,
        total_usd: order.total_usd,
        cliente: order.customer ? {
          id: order.customer.id,
          nombre: order.customer.name,
          email: order.customer.email,
          telefono: order.customer.phone,
          identificacion: order.customer.identification,
        } : null,
        contacto_email: order.contact_email,
        contacto_telefono: order.contact_phone,
        productos: (order.products ?? []).map(p => ({
          producto_id: p.product_id,
          variante_id: p.variant_id,
          nombre: p.name,
          sku: p.sku,
          cantidad: p.quantity,
          precio_unitario: p.price,
        })),
        envio_metodo: order.shipping_option,
        tracking: order.shipping_tracking_number,
        creada: order.created_at,
        actualizada: order.updated_at,
        completada: order.completed_at,
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Orden #${order.number} (id ${order.id}):\n\n${JSON.stringify(detail, null, 2)}`,
        }],
      }
    }
  )
}

export function registerUpdateOrderStatus(server: McpServer) {
  server.registerTool(
    'update_order_status',
    {
      description: 'Cambia el estado de una orden: cerrar (close), reabrir (open) o cancelar (cancel). El cancel puede devolver dinero y restaurar stock.',
      inputSchema: {
        id: z.number().describe('ID de la orden.'),
        action: z.enum(['close', 'open', 'cancel']).describe('Acción a ejecutar.'),
        reason: z.enum(['customer', 'inventory', 'fraud', 'other']).optional()
          .describe('Motivo (solo para cancel).'),
        email: z.boolean().optional().describe('Notificar al cliente por email (default según configuración de la tienda).'),
        restock: z.boolean().optional().describe('Restaurar stock al cancelar (solo para cancel).'),
        refund: z.boolean().optional().describe('Marcar como reembolsado al cancelar (solo para cancel).'),
      },
    },
    async ({ id, action, reason, email, restock, refund }) => {
      const body: Record<string, unknown> = {}
      if (action === 'cancel') {
        if (reason) body.reason = reason
        if (email !== undefined) body.email = email
        if (restock !== undefined) body.restock = restock
        if (refund !== undefined) body.refund = refund
      } else if (action === 'close' || action === 'open') {
        if (email !== undefined) body.email = email
      }

      await tnFetch(`/orders/${id}/${action}`, {
        method: 'POST',
        body,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Orden ${id}: acción "${action}" ejecutada correctamente` +
            (action === 'cancel' && reason ? ` (motivo: ${reason})` : '') + '.',
        }],
      }
    }
  )
}
