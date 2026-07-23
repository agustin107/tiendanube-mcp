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
        { params: args as Record<string, string | number | boolean | undefined>, emptyArrayOn404: true }
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

export function registerGetCategory(server: McpServer) {
  server.registerTool(
    'get_category',
    {
      description: 'Obtiene una categoría completa por ID. Incluye nombre, descripción, handle, subcategorías y visibilidad.',
      inputSchema: {
        id: z.number().describe('ID de la categoría.'),
      },
    },
    async ({ id }) => {
      const category = await tnFetch<TNCategory>(`/categories/${id}`)

      return {
        content: [{
          type: 'text' as const,
          text: `Categoría ${category.id}:\n\n${JSON.stringify({
            id: category.id,
            nombre: pickLocalized(category.name),
            descripcion: pickLocalized(category.description),
            handle: pickLocalized(category.handle),
            padre: category.parent,
            subcategorias: category.subcategories,
            visibilidad: category.visibility,
            google_shopping: category.google_shopping_category,
            creada: category.created_at,
          }, null, 2)}`,
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
      description: 'Actualiza una categoría existente. IMPORTANTE: la API de TiendaNube hace REPLACE (no merge) en PUT /categories/{id}, por lo que esta tool trae la categoría actual y reenvía SIEMPRE el payload completo mergeando tus cambios, para no borrar name/handle/parent/description. Podés pasar solo el/los campo(s) que querés cambiar.',
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
      const provided = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined)
      )

      // La API de TiendaNube hace REPLACE en PUT /categories/{id}: los campos que
      // no se envían se resetean (name/handle -> "", parent -> raíz). Para evitar
      // pérdida de datos, traemos la categoría actual y mergeamos, enviando SIEMPRE
      // el payload completo.
      const current = await tnFetch<TNCategory>(`/categories/${id}`)

      const fullBody: Record<string, unknown> = {
        name: current.name,
        handle: current.handle,
        parent: current.parent ?? null,
      }
      if (current.description !== undefined) fullBody.description = current.description
      if (current.google_shopping_category) fullBody.google_shopping_category = current.google_shopping_category

      // Los campos provistos por el caller pisan a los actuales.
      Object.assign(fullBody, provided)

      const updated = await tnFetch<TNCategory>(`/categories/${id}`, {
        method: 'PUT',
        body: fullBody,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Categoría ${updated.id} actualizada ("${pickLocalized(updated.name)}").\n` +
            `Campos modificados: ${Object.keys(provided).join(', ') || 'ninguno'} ` +
            `(payload completo reenviado para preservar el resto).`,
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
