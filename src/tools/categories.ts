import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, tnFetchWithMeta, pickLocalized } from '../client.js'
import type { TNCategory, TNLocalized } from '../types.js'

// Un campo multilenguaje de TN puede volver como {} o { es: '' } en tiendas donde
// el dato no está poblado. Mandarlo así en un PUT dispara un 422 de validación,
// así que hay que saber distinguir "vacío" de "con contenido".
function hasContent(value: TNLocalized | string | null | undefined): boolean {
  if (!value) return false
  if (typeof value === 'string') return value.trim() !== ''
  return Object.values(value).some(v => typeof v === 'string' && v.trim() !== '')
}


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
            seo_title: pickLocalized(category.seo_title),
            seo_description: pickLocalized(category.seo_description),
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
        seo_title: z.record(z.string()).optional().describe('SEO title por idioma. Máx ~60 chars.'),
        seo_description: z.record(z.string()).optional().describe('Meta description por idioma. Máx ~155 chars.'),
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
      description: 'Actualiza una categoría existente, incluyendo su SEO (seo_title / seo_description). Pasá solo el/los campo(s) que querés cambiar: PUT /categories/{id} hace merge. Como red de seguridad la tool trae la categoría actual y reenvía los campos que ya tienen contenido, pero NUNCA manda un campo vacío (la API devuelve name/handle en blanco en algunas tiendas y eso dispara un 422).',
      inputSchema: {
        id: z.number().describe('ID de la categoría.'),
        name: z.record(z.string()).optional().describe('Nuevo nombre por idioma.'),
        description: z.record(z.string()).optional().describe('Nueva descripción por idioma.'),
        parent: z.number().optional().nullable().describe('Nuevo padre (null para volverla raíz).'),
        handle: z.record(z.string()).optional(),
        google_shopping_category: z.string().optional().nullable(),
        seo_title: z.record(z.string()).optional().describe('SEO title por idioma, ej: { es: "Soldadoras Inverter | KitMaq" }. Máx ~60 chars.'),
        seo_description: z.record(z.string()).optional().describe('Meta description por idioma. Máx ~155 chars.'),
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

      const fullBody: Record<string, unknown> = {}

      // Reenviamos los campos actuales SOLO si tienen contenido real.
      // Motivo: en algunas tiendas la API devuelve `name` y `handle` como objetos
      // vacíos; si los reenviamos, el PUT falla con 422 ("name: can't be blank").
      // Omitirlos es seguro porque PUT /categories/{id} hace merge: lo que no se
      // manda queda como está.
      if (hasContent(current.name)) fullBody.name = current.name
      if (hasContent(current.handle)) fullBody.handle = current.handle
      // OJO: la API devuelve parent = 0 para las categorías raíz, pero rechaza
      // ese 0 en el PUT con un 500. Para una raíz directamente no lo mandamos.
      if (current.parent) fullBody.parent = current.parent
      if (hasContent(current.description)) fullBody.description = current.description
      if (current.google_shopping_category) fullBody.google_shopping_category = current.google_shopping_category
      if (hasContent(current.seo_title)) fullBody.seo_title = current.seo_title
      if (hasContent(current.seo_description)) fullBody.seo_description = current.seo_description

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
            `Campos modificados: ${Object.keys(provided).join(', ') || 'ninguno'}. ` +
            `Reenviados para preservar: ${Object.keys(fullBody).filter(k => !(k in provided)).join(', ') || 'ninguno'}.`,
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
