import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, tnFetchWithMeta, pickLocalized } from '../client.js'
import type { TNCategory } from '../types.js'

export function registerListCategories(server: McpServer) {
  server.registerTool(
    'list_categories',
    {
      description: 'Lista las categorías de la tienda. Permite filtrar por categoría padre (parent_id=null para las raíz) y handle.',
      inputSchema: {
        parent_id: z.number().optional().describe('ID de la categoría padre. 0 para categorías raíz.'),
        handle: z.string().optional().describe('Handle (URL-friendly) exacto.'),
        language: z.string().optional().describe('Idioma para búsqueda por handle (ej: es, pt).'),
        since_id: z.number().optional(),
        page: z.number().min(1).optional(),
        per_page: z.number().min(1).max(200).optional(),
      },
    },
    async (args) => {
      const { data: categories, totalCount } = await tnFetchWithMeta<TNCategory[]>(
        '/categories',
        { params: args as Record<string, string | number | boolean | undefined> }
      )

      if (!categories || categories.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No se encontraron categorías con los filtros indicados.' }] }
      }

      const summary = categories.map(c => ({
        id: c.id,
        nombre: pickLocalized(c.name),
        handle: pickLocalized(c.handle),
        padre: c.parent,
        visibilidad: c.visibility,
        subcategorias: c.subcategories?.length ?? 0,
        google_shopping: c.google_shopping_category,
      }))

      return {
        content: [{
          type: 'text' as const,
          text: `${summary.length} categorías${totalCount ? ` (de ${totalCount} total)` : ''}:\n\n` +
            JSON.stringify(summary, null, 2),
        }],
      }
    }
  )
}

export function registerCreateCategory(server: McpServer) {
  server.registerTool(
    'create_category',
    {
      description: 'Crea una categoría nueva. `name` es obligatorio y debe ser un objeto multilenguaje, ej: { es: "Iluminación" }. Para subcategorías indicar `parent` con el id de la categoría padre.',
      inputSchema: {
        name: z.record(z.string()).describe('Nombre por idioma, ej: { es: "Herramientas Eléctricas" }.'),
        description: z.record(z.string()).optional().describe('Descripción por idioma (HTML soportado).'),
        parent: z.number().optional().describe('ID de la categoría padre (para subcategorías).'),
        handle: z.record(z.string()).optional().describe('Handle URL-friendly por idioma. Si se omite, TN lo genera del nombre.'),
        google_shopping_category: z.string().optional().describe('Taxonomía Google Shopping (ej: "Hardware > Tools").'),
      },
    },
    async (args) => {
      const cleaned = Object.fromEntries(
        Object.entries(args).filter(([, v]) => v !== undefined)
      )

      const created = await tnFetch<TNCategory>('/categories', {
        method: 'POST',
        body: cleaned,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Categoría creada: id ${created.id} ("${pickLocalized(created.name)}").\n` +
            `Handle: ${pickLocalized(created.handle)}. Padre: ${created.parent ?? 'raíz'}.`,
        }],
      }
    }
  )
}

export function registerUpdateCategory(server: McpServer) {
  server.registerTool(
    'update_category',
    {
      description: 'Actualiza una categoría existente. Sólo los campos provistos se modifican.',
      inputSchema: {
        id: z.number().describe('ID de la categoría.'),
        name: z.record(z.string()).optional().describe('Nuevo nombre por idioma.'),
        description: z.record(z.string()).optional().describe('Nueva descripción por idioma.'),
        parent: z.number().optional().nullable().describe('Nuevo padre (null para volverla raíz).'),
        handle: z.record(z.string()).optional(),
        google_shopping_category: z.string().optional().nullable(),
      },
    },
    async ({ id, ...body }) => {
      const cleaned = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined)
      )

      const updated = await tnFetch<TNCategory>(`/categories/${id}`, {
        method: 'PUT',
        body: cleaned,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Categoría ${updated.id} actualizada ("${pickLocalized(updated.name)}").\n` +
            `Campos modificados: ${Object.keys(cleaned).join(', ') || 'ninguno'}.`,
        }],
      }
    }
  )
}

export function registerDeleteCategory(server: McpServer) {
  server.registerTool(
    'delete_category',
    {
      description: 'Elimina una categoría. Los productos que estaban en ella quedan sin esa categoría (no se eliminan). Las subcategorías deben moverse o eliminarse antes.',
      inputSchema: {
        id: z.number().describe('ID de la categoría a eliminar.'),
      },
    },
    async ({ id }) => {
      await tnFetch(`/categories/${id}`, { method: 'DELETE' })

      return {
        content: [{
          type: 'text' as const,
          text: `Categoría ${id} eliminada.`,
        }],
      }
    }
  )
}
