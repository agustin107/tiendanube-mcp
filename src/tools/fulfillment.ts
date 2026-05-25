import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, tnFetchWithMeta } from '../client.js'
import type { TNFulfillmentOrder, TNTrackingEvent } from '../types.js'

export function registerListFulfillmentOrders(server: McpServer) {
  server.registerTool(
    'list_fulfillment_orders',
    {
      description: 'Lista los fulfillment orders de una orden. Cada fulfillment order representa un paquete a despachar, con su estado y número de seguimiento.',
      inputSchema: {
        order_id: z.number().describe('ID de la orden.'),
      },
    },
    async ({ order_id }) => {
      const { data: items } = await tnFetchWithMeta<TNFulfillmentOrder[]>(
        `/orders/${order_id}/fulfillment-orders`
      )

      if (!items || items.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `La orden ${order_id} no tiene fulfillment orders.` }],
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }],
      }
    }
  )
}

export function registerGetFulfillmentOrder(server: McpServer) {
  server.registerTool(
    'get_fulfillment_order',
    {
      description: 'Obtiene el detalle de un fulfillment order específico (estado, tracking, destino, etc.).',
      inputSchema: {
        order_id: z.number().describe('ID de la orden.'),
        fulfillment_order_id: z.number().describe('ID del fulfillment order.'),
      },
    },
    async ({ order_id, fulfillment_order_id }) => {
      const item = await tnFetch<TNFulfillmentOrder>(
        `/orders/${order_id}/fulfillment-orders/${fulfillment_order_id}`
      )
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }],
      }
    }
  )
}

export function registerUpdateFulfillmentOrder(server: McpServer) {
  server.registerTool(
    'update_fulfillment_order',
    {
      description: 'Actualiza un fulfillment order: estado, número de seguimiento, carrier o fecha estimada de entrega.',
      inputSchema: {
        order_id: z.number().describe('ID de la orden.'),
        fulfillment_order_id: z.number().describe('ID del fulfillment order.'),
        status: z.string().optional().describe('Nuevo estado (ej: DISPATCHED, FULFILLED, CANCELLED).'),
        shipping_tracking_number: z.string().optional().describe('Número de tracking del envío.'),
        shipping_tracking_url: z.string().url().optional().describe('URL de seguimiento del envío.'),
        estimated_delivery_at: z.string().optional().describe('Fecha estimada de entrega (ISO 8601).'),
      },
    },
    async ({ order_id, fulfillment_order_id, ...rest }) => {
      const body = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      )
      const item = await tnFetch<TNFulfillmentOrder>(
        `/orders/${order_id}/fulfillment-orders/${fulfillment_order_id}`,
        { method: 'PATCH', body }
      )
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Fulfillment order ${fulfillment_order_id} actualizado:`,
            `  estado: ${item.status}`,
            `  tracking: ${item.shipping_tracking_number ?? '-'}`,
            `  url: ${item.shipping_tracking_url ?? '-'}`,
          ].join('\n'),
        }],
      }
    }
  )
}

export function registerAddTrackingEvent(server: McpServer) {
  server.registerTool(
    'add_tracking_event',
    {
      description: 'Agrega un evento de tracking a un fulfillment order. La orden debe estar en estado DISPATCHED. Usar status "delivered" marca el fulfillment como completado.',
      inputSchema: {
        order_id: z.number().describe('ID de la orden.'),
        fulfillment_order_id: z.number().describe('ID del fulfillment order.'),
        status: z.string().describe('Estado del evento (ej: dispatched, in_transit, out_for_delivery, delivered, failed).'),
        description: z.string().optional().describe('Descripción del evento.'),
        city: z.string().optional().describe('Ciudad donde ocurrió el evento.'),
      },
    },
    async ({ order_id, fulfillment_order_id, ...rest }) => {
      const body = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      )
      const event = await tnFetch<TNTrackingEvent>(
        `/orders/${order_id}/fulfillment-orders/${fulfillment_order_id}/tracking-events`,
        { method: 'POST', body }
      )
      return {
        content: [{
          type: 'text' as const,
          text: `Evento de tracking creado:\n` + JSON.stringify(event, null, 2),
        }],
      }
    }
  )
}

export function registerListTrackingEvents(server: McpServer) {
  server.registerTool(
    'list_tracking_events',
    {
      description: 'Lista todos los eventos de tracking de un fulfillment order, en orden cronológico.',
      inputSchema: {
        order_id: z.number().describe('ID de la orden.'),
        fulfillment_order_id: z.number().describe('ID del fulfillment order.'),
      },
    },
    async ({ order_id, fulfillment_order_id }) => {
      const { data: events } = await tnFetchWithMeta<TNTrackingEvent[]>(
        `/orders/${order_id}/fulfillment-orders/${fulfillment_order_id}/tracking-events`
      )

      if (!events || events.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'Sin eventos de tracking registrados.' }],
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(events, null, 2) }],
      }
    }
  )
}
