import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, tnFetchWithMeta } from '../client.js'
import type { TNOrder } from '../types.js'

export function registerGetOrderHistoryValues(server: McpServer) {
  server.registerTool(
    'get_order_history_values',
    {
      description: 'Obtiene el historial de alteraciones de valor de una orden (ediciones y reembolsos). Devuelve status, total_delta, total_paid_diff, gateway y timestamps.',
      inputSchema: {
        id: z.number().describe('ID de la orden.'),
      },
    },
    async ({ id }) => {
      const result = await tnFetch<unknown>(`/orders/${id}/history/values`)

      return {
        content: [{
          type: 'text' as const,
          text: `Historial de valores de la orden ${id}:\n\n${JSON.stringify(result, null, 2)}`,
        }],
      }
    }
  )
}

export function registerGetOrderHistoryEditions(server: McpServer) {
  server.registerTool(
    'get_order_history_editions',
    {
      description: 'Obtiene el changelog de ediciones de una orden: productos agregados/removidos, cambios de envío y transacción asociada.',
      inputSchema: {
        id: z.number().describe('ID de la orden.'),
      },
    },
    async ({ id }) => {
      const result = await tnFetch<unknown>(`/orders/${id}/history/editions`)

      return {
        content: [{
          type: 'text' as const,
          text: `Historial de ediciones de la orden ${id}:\n\n${JSON.stringify(result, null, 2)}`,
        }],
      }
    }
  )
}

export function registerCreateOrder(server: McpServer) {
  server.registerTool(
    'create_order',
    {
      description: 'Crea una orden vía API. Las órdenes creadas así tienen storefront="api". No se crean transacciones automáticamente; usá owner_note para guardar referencias de pago externas.',
      inputSchema: {
        products: z.array(z.object({
          variant_id: z.number().describe('ID de la variante.'),
          quantity: z.number().int().min(1).describe('Cantidad.'),
          price: z.union([z.string(), z.number()]).optional().describe('Precio custom (default: precio de la variante).'),
        })).describe('Productos de la orden.'),
        customer: z.object({
          name: z.string().describe('Nombre del cliente.'),
          email: z.string().describe('Email del cliente.'),
          phone: z.string().optional(),
          document: z.string().optional().describe('Documento/identificación.'),
        }).describe('Datos del cliente.'),
        billing_address: z.record(z.string()).optional().describe('Dirección de facturación (first_name, last_name, address, number, city, province, zipcode, country).'),
        shipping_address: z.record(z.string()).optional().describe('Dirección de envío (misma estructura que billing_address).'),
        currency: z.string().optional().describe('Código de moneda ISO 4217 (ej: ARS, BRL, USD).'),
        language: z.string().optional().describe('Código de idioma ISO 639-1 (ej: es, pt, en).'),
        gateway: z.string().optional().describe('Gateway de pago (offline, mercadopago, pagseguro, payu, not-provided).'),
        payment_status: z.enum(['pending', 'authorized', 'paid', 'voided', 'refunded', 'abandoned']).optional(),
        status: z.enum(['open', 'closed', 'cancelled']).optional(),
        shipping_status: z.enum(['unpacked', 'unfulfilled', 'fulfilled']).optional(),
        shipping_pickup_type: z.enum(['ship', 'pickup']).optional(),
        shipping_store_branch_name: z.string().optional().describe('Nombre de sucursal para retiro.'),
        shipping_min_delivery_date: z.string().optional().describe('Fecha mínima de entrega (ISO 8601).'),
        shipping_max_delivery_date: z.string().optional().describe('Fecha máxima de entrega (ISO 8601).'),
        shipping_tracking_number: z.string().optional(),
        shipping_tracking_url: z.string().optional(),
        shipping_cost_owner: z.string().optional().describe('Costo de envío para el vendedor.'),
        shipping_cost_customer: z.string().optional().describe('Costo de envío para el cliente.'),
        note: z.string().optional().describe('Nota del cliente.'),
        owner_note: z.string().optional().describe('Nota interna del vendedor (no visible al cliente).'),
        inventory_behaviour: z.enum(['bypass', 'claim']).optional().describe('"bypass": no reserva stock; "claim": reserva stock.'),
        discount_coupon: z.string().optional().describe('Código de cupón.'),
        extra: z.record(z.unknown()).optional().describe('Campos custom adicionales.'),
      },
    },
    async (args) => {
      const body = Object.fromEntries(
        Object.entries(args).filter(([, v]) => v !== undefined)
      )

      const order = await tnFetch<TNOrder>('/orders', {
        method: 'POST',
        body,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Orden creada: #${order.number} (id ${order.id}).\n` +
            `Estado: ${order.status} | Pago: ${order.payment_status} | Envío: ${order.shipping_status}.\n` +
            `Total: ${order.currency} ${order.total}.`,
        }],
      }
    }
  )
}

export function registerUpdateOrder(server: McpServer) {
  server.registerTool(
    'update_order',
    {
      description: 'Actualiza atributos editables de una orden (owner_note y/o status). Para cerrar/reabrir/cancelar usar close_order, open_order, cancel_order.',
      inputSchema: {
        id: z.number().describe('ID de la orden.'),
        owner_note: z.string().optional().describe('Nota interna del vendedor.'),
        status: z.enum(['open', 'closed', 'cancelled']).optional(),
      },
    },
    async ({ id, ...body }) => {
      const cleaned = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined))
      const updated = await tnFetch<TNOrder>(`/orders/${id}`, { method: 'PUT', body: cleaned })

      return {
        content: [{
          type: 'text' as const,
          text: `Orden ${id} actualizada. Estado: ${updated.status}.`,
        }],
      }
    }
  )
}

export function registerCloseOrder(server: McpServer) {
  server.registerTool(
    'close_order',
    {
      description: 'Cierra una orden (la marca como completada). La orden queda con status="closed".',
      inputSchema: {
        id: z.number().describe('ID de la orden.'),
      },
    },
    async ({ id }) => {
      await tnFetch(`/orders/${id}/close`, { method: 'POST' })

      return {
        content: [{
          type: 'text' as const,
          text: `Orden ${id} cerrada.`,
        }],
      }
    }
  )
}

export function registerOpenOrder(server: McpServer) {
  server.registerTool(
    'open_order',
    {
      description: 'Reabre una orden cerrada. La orden vuelve a status="open".',
      inputSchema: {
        id: z.number().describe('ID de la orden.'),
      },
    },
    async ({ id }) => {
      await tnFetch(`/orders/${id}/open`, { method: 'POST' })

      return {
        content: [{
          type: 'text' as const,
          text: `Orden ${id} reabierta.`,
        }],
      }
    }
  )
}

export function registerCancelOrder(server: McpServer) {
  server.registerTool(
    'cancel_order',
    {
      description: 'Cancela una orden. Puede notificar al cliente, restaurar stock y/o marcar como reembolsada.',
      inputSchema: {
        id: z.number().describe('ID de la orden.'),
        reason: z.enum(['customer', 'inventory', 'fraud', 'other']).optional().describe('Motivo de cancelación.'),
        email: z.boolean().optional().describe('Notificar al cliente por email.'),
        restock: z.boolean().optional().describe('Restaurar stock al cancelar.'),
        refund: z.boolean().optional().describe('Marcar como reembolsado.'),
      },
    },
    async ({ id, reason, email, restock, refund }) => {
      const body: Record<string, unknown> = {}
      if (reason !== undefined) body.reason = reason
      if (email !== undefined) body.email = email
      if (restock !== undefined) body.restock = restock
      if (refund !== undefined) body.refund = refund

      await tnFetch(`/orders/${id}/cancel`, { method: 'POST', body })

      return {
        content: [{
          type: 'text' as const,
          text: `Orden ${id} cancelada${reason ? ` (motivo: ${reason})` : ''}.`,
        }],
      }
    }
  )
}

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
