import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, tnFetchWithMeta } from '../client.js'
import type { TNCustomer } from '../types.js'

export function registerListCustomers(server: McpServer) {
  server.registerTool(
    'list_customers',
    {
      description: 'Lista clientes de la tienda con filtros por búsqueda de texto, email exacto y rango de fecha. Soporta paginación (per_page máx 200, default 30).',
      inputSchema: {
        q: z.string().optional().describe('Texto de búsqueda (nombre, email, identificación).'),
        email: z.string().email().optional().describe('Match exacto por email.'),
        created_at_min: z.string().optional(),
        created_at_max: z.string().optional(),
        updated_at_min: z.string().optional(),
        since_id: z.number().optional().describe('Retornar clientes con id mayor al indicado.'),
        page: z.number().min(1).optional(),
        per_page: z.number().min(1).max(200).optional(),
      },
    },
    async (args) => {
      const { data: customers, totalCount } = await tnFetchWithMeta<TNCustomer[]>(
        '/customers',
        { params: args as Record<string, string | number | boolean | undefined> }
      )

      if (!customers || customers.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No se encontraron clientes con los filtros indicados.' }] }
      }

      const summary = customers.map(c => ({
        id: c.id,
        nombre: c.name,
        email: c.email,
        telefono: c.phone,
        identificacion: c.identification,
        total_gastado: `${c.total_spent_currency} ${c.total_spent}`,
        ultima_orden: c.last_order_id,
        acepta_marketing: c.accepts_marketing,
        activo: c.active,
        creado: c.created_at,
      }))

      return {
        content: [{
          type: 'text' as const,
          text: `${summary.length} clientes${totalCount ? ` (de ${totalCount} total)` : ''}:\n\n` +
            JSON.stringify(summary, null, 2),
        }],
      }
    }
  )
}

export function registerGetCustomer(server: McpServer) {
  server.registerTool(
    'get_customer',
    {
      description: 'Obtiene un cliente completo por id, incluyendo dirección default y datos de facturación.',
      inputSchema: {
        id: z.number().describe('ID del cliente.'),
      },
    },
    async ({ id }) => {
      const customer = await tnFetch<TNCustomer>(`/customers/${id}`)

      return {
        content: [{
          type: 'text' as const,
          text: `Cliente ${customer.id}:\n\n${JSON.stringify(customer, null, 2)}`,
        }],
      }
    }
  )
}

// Schema reutilizable para addresses (tanto en create como update)
const addressSchema = z.object({
  address: z.string().describe('Calle.'),
  number: z.string().describe('Número.'),
  floor: z.string().optional(),
  locality: z.string().optional().describe('Barrio.'),
  city: z.string(),
  province: z.string(),
  country: z.string().describe('Código ISO 3166-1 alpha-2 (ej "AR", "BR").'),
  zipcode: z.string(),
  phone: z.string().optional(),
})

export function registerCreateCustomer(server: McpServer) {
  server.registerTool(
    'create_customer',
    {
      description: 'Crea un cliente nuevo. `email` es obligatorio. Para addresses, country va en código ISO ("AR"). Si querés enviar invitación por email, usar send_email_invite=true (TN manda el mail).',
      inputSchema: {
        email: z.string().email().describe('Email del cliente (obligatorio).'),
        name: z.string().optional(),
        phone: z.string().optional(),
        identification: z.string().optional().describe('Documento/CUIT/CUIL/CPF.'),
        note: z.string().optional().describe('Nota interna del vendedor.'),
        addresses: z.array(addressSchema).optional().describe('Direcciones de envío.'),
        billing_address: z.string().optional().describe('Dirección de facturación: calle.'),
        billing_number: z.string().optional(),
        billing_floor: z.string().optional(),
        billing_locality: z.string().optional(),
        billing_zipcode: z.string().optional(),
        billing_city: z.string().optional(),
        billing_province: z.string().optional(),
        billing_country: z.string().optional().describe('Código ISO de país para facturación.'),
        billing_phone: z.string().optional(),
        extra: z.record(z.unknown()).optional().describe('Campos custom como objeto JSON.'),
        send_email_invite: z.boolean().optional().describe('Mandar email de bienvenida.'),
        password: z.string().optional().describe('Password si querés crear la cuenta directamente.'),
      },
    },
    async (args) => {
      const cleaned = Object.fromEntries(
        Object.entries(args).filter(([, v]) => v !== undefined)
      )

      const created = await tnFetch<TNCustomer>('/customers', {
        method: 'POST',
        body: cleaned,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Cliente creado: id ${created.id} (${created.email ?? 'sin email'}).\n` +
            `Nombre: ${created.name ?? '—'}. Activo: ${created.active}.`,
        }],
      }
    }
  )
}

export function registerUpdateCustomer(server: McpServer) {
  server.registerTool(
    'update_customer',
    {
      description: 'Actualiza un cliente existente. Sólo los campos provistos se modifican. OJO: si pasás `addresses`, reemplaza todas las direcciones existentes.',
      inputSchema: {
        id: z.number().describe('ID del cliente.'),
        email: z.string().email().optional(),
        name: z.string().optional(),
        phone: z.string().optional(),
        identification: z.string().optional(),
        note: z.string().optional(),
        addresses: z.array(addressSchema).optional().describe('Reemplaza todas las direcciones del cliente.'),
        billing_address: z.string().optional(),
        billing_number: z.string().optional(),
        billing_floor: z.string().optional(),
        billing_locality: z.string().optional(),
        billing_zipcode: z.string().optional(),
        billing_city: z.string().optional(),
        billing_province: z.string().optional(),
        billing_country: z.string().optional(),
        billing_phone: z.string().optional(),
        extra: z.record(z.unknown()).optional(),
      },
    },
    async ({ id, ...body }) => {
      const cleaned = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined)
      )

      const updated = await tnFetch<TNCustomer>(`/customers/${id}`, {
        method: 'PUT',
        body: cleaned,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Cliente ${updated.id} actualizado.\n` +
            `Campos modificados: ${Object.keys(cleaned).join(', ') || 'ninguno'}.`,
        }],
      }
    }
  )
}

export function registerDeleteCustomer(server: McpServer) {
  server.registerTool(
    'delete_customer',
    {
      description: 'Elimina un cliente. ATENCIÓN: no se puede eliminar un cliente que tenga órdenes asociadas (TN devuelve 422). Para esos casos usar update_customer y marcarlo como inactivo en `extra`.',
      inputSchema: {
        id: z.number().describe('ID del cliente a eliminar.'),
      },
    },
    async ({ id }) => {
      await tnFetch(`/customers/${id}`, { method: 'DELETE' })

      return {
        content: [{
          type: 'text' as const,
          text: `Cliente ${id} eliminado.`,
        }],
      }
    }
  )
}
