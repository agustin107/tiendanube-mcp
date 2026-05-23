import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetchWithMeta } from '../client.js'
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
