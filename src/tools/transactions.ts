import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, tnFetchWithMeta } from '../client.js'
import type { TNTransaction } from '../types.js'

export function registerListOrderTransactions(server: McpServer) {
  server.registerTool(
    'list_order_transactions',
    {
      description: 'Lista todas las transacciones de pago de una orden: método de pago, estado, montos capturados y reembolsados.',
      inputSchema: {
        order_id: z.number().describe('ID de la orden.'),
      },
    },
    async ({ order_id }) => {
      const { data: transactions } = await tnFetchWithMeta<TNTransaction[]>(
        `/orders/${order_id}/transactions`
      )

      if (!transactions || transactions.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `La orden ${order_id} no tiene transacciones registradas.` }],
        }
      }

      const summary = transactions.map(t => ({
        id: t.id,
        estado: t.status,
        metodo: t.payment_method_type ?? '-',
        capturado: t.amount_captured ? `${t.currency} ${t.amount_captured}` : '-',
        reembolsado: t.amount_refunded ? `${t.currency} ${t.amount_refunded}` : '-',
        autorizado: t.amount_authorized ? `${t.currency} ${t.amount_authorized}` : '-',
        error: t.failure_message ?? null,
        creado: t.created_at,
      }))

      return {
        content: [{
          type: 'text' as const,
          text: `Transacciones de la orden ${order_id} (${transactions.length}):\n\n` +
            JSON.stringify(summary, null, 2),
        }],
      }
    }
  )
}

export function registerGetOrderTransaction(server: McpServer) {
  server.registerTool(
    'get_order_transaction',
    {
      description: 'Obtiene el detalle completo de una transacción de pago: método, montos, estado, código de error y referencia externa.',
      inputSchema: {
        order_id: z.number().describe('ID de la orden.'),
        transaction_id: z.number().describe('ID de la transacción.'),
      },
    },
    async ({ order_id, transaction_id }) => {
      const transaction = await tnFetch<TNTransaction>(
        `/orders/${order_id}/transactions/${transaction_id}`
      )
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(transaction, null, 2) }],
      }
    }
  )
}
