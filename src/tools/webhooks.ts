import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, tnFetchWithMeta } from '../client.js'
import type { TNWebhook } from '../types.js'

export function registerListWebhooks(server: McpServer) {
  server.registerTool(
    'list_webhooks',
    {
      description: 'Lista los webhooks registrados por tu app en esta tienda. Útil para debugging de notificaciones product/* u order/*.',
      inputSchema: {
        url: z.string().optional().describe('Filtrar por URL exacta.'),
        event: z.string().optional().describe('Filtrar por evento (ej: "order/paid", "product/created").'),
        since_id: z.number().optional(),
        page: z.number().min(1).optional(),
        per_page: z.number().min(1).max(200).optional(),
      },
    },
    async (args) => {
      const { data: hooks, totalCount } = await tnFetchWithMeta<TNWebhook[]>(
        '/webhooks',
        { params: args as Record<string, string | number | boolean | undefined> }
      )

      if (!hooks || hooks.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No hay webhooks registrados para tu app en esta tienda.' }] }
      }

      return {
        content: [{
          type: 'text' as const,
          text: `${hooks.length} webhooks${totalCount ? ` (de ${totalCount} total)` : ''}:\n\n` +
            JSON.stringify(hooks, null, 2),
        }],
      }
    }
  )
}

export function registerGetWebhook(server: McpServer) {
  server.registerTool(
    'get_webhook',
    {
      description: 'Obtiene un webhook por ID.',
      inputSchema: {
        id: z.number().describe('ID del webhook.'),
      },
    },
    async ({ id }) => {
      const hook = await tnFetch<TNWebhook>(`/webhooks/${id}`)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(hook, null, 2) }],
      }
    }
  )
}

export function registerCreateWebhook(server: McpServer) {
  server.registerTool(
    'create_webhook',
    {
      description: 'Crea un nuevo webhook. Eventos disponibles: store/redeem, app/uninstalled, category/created, category/updated, category/deleted, product/created, product/updated, product/deleted, order/created, order/updated, order/paid, order/fulfilled, order/cancelled.',
      inputSchema: {
        url: z.string().url().describe('URL HTTPS que recibirá el POST del evento.'),
        event: z.string().describe('Evento a suscribir (ej: "order/paid", "product/created").'),
      },
    },
    async ({ url, event }) => {
      const hook = await tnFetch<TNWebhook>('/webhooks', {
        method: 'POST',
        body: { url, event },
      })
      return {
        content: [{
          type: 'text' as const,
          text: `Webhook creado:\n  id: ${hook.id}\n  evento: ${hook.event}\n  url: ${hook.url}`,
        }],
      }
    }
  )
}

export function registerUpdateWebhook(server: McpServer) {
  server.registerTool(
    'update_webhook',
    {
      description: 'Actualiza la URL o el evento de un webhook existente.',
      inputSchema: {
        id: z.number().describe('ID del webhook a actualizar.'),
        url: z.string().url().optional().describe('Nueva URL.'),
        event: z.string().optional().describe('Nuevo evento.'),
      },
    },
    async ({ id, url, event }) => {
      const body: Record<string, string> = {}
      if (url) body.url = url
      if (event) body.event = event
      const hook = await tnFetch<TNWebhook>(`/webhooks/${id}`, {
        method: 'PUT',
        body,
      })
      return {
        content: [{
          type: 'text' as const,
          text: `Webhook ${hook.id} actualizado:\n  evento: ${hook.event}\n  url: ${hook.url}`,
        }],
      }
    }
  )
}

export function registerDeleteWebhook(server: McpServer) {
  server.registerTool(
    'delete_webhook',
    {
      description: 'Elimina un webhook por ID.',
      inputSchema: {
        id: z.number().describe('ID del webhook a eliminar.'),
      },
    },
    async ({ id }) => {
      await tnFetch<unknown>(`/webhooks/${id}`, { method: 'DELETE' })
      return {
        content: [{ type: 'text' as const, text: `Webhook ${id} eliminado.` }],
      }
    }
  )
}
