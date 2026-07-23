// Tools de Páginas institucionales (API 2025-03, /pages).
// Requiere scopes read_content / write_content en el token.
// Las páginas son las estáticas de la tienda: Quiénes Somos, Envíos, Contacto, etc.

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, pickLocalized } from '../client.js'
import type { TNPage, TNPagesResponse } from '../types.js'

const V = { apiVersion: '2025-03' as const }

// La API 2025-03 de páginas escribe con el envelope { page: { publish, i18n: { <locale>: {...} } } }
// y el locale es COMPLETO (es_AR, pt_BR, en_US), aunque el GET colapse la clave a 'es'.
// Normalizamos códigos cortos al locale para que create/update no fallen (400 "título vacío").
const LOCALE_MAP: Record<string, string> = { es: 'es_AR', pt: 'pt_BR', en: 'en_US' }
function toLocale(language?: string): string {
  const l = (language || 'es').trim()
  if (l.includes('_')) return l
  return LOCALE_MAP[l] ?? l
}

export function registerListPages(server: McpServer) {
  server.registerTool(
    'list_pages',
    {
      description:
        'Lista las páginas estáticas/institucionales de la tienda (Quiénes Somos, Envíos, Contacto, etc.). Devuelve id, nombre, handle y estado de publicación. Soporta paginación. NO incluye el HTML completo — usar get_page para eso. Requiere scope read_content.',
      inputSchema: {
        page: z.number().min(1).optional().describe('Número de página (1-based, default 1).'),
      },
    },
    async ({ page }) => {
      const resp = await tnFetch<TNPagesResponse>('/pages', {
        ...V,
        params: page ? { page } : undefined,
      })

      const results = resp?.pages?.results ?? []
      if (results.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No se encontraron páginas.' }] }
      }

      const summary = results.map((p) => ({
        id: p.id,
        nombre: pickLocalized(p.name),
        handle: pickLocalized(p.handle),
        publicada: p.published,
        actualizada: p.updated_at,
      }))

      const meta = resp.pages
      return {
        content: [{
          type: 'text' as const,
          text: `${summary.length} páginas (de ${meta.total} total, página ${meta.page}/${meta.lastPage}):\n\n` +
            JSON.stringify(summary, null, 2),
        }],
      }
    }
  )
}

export function registerGetPage(server: McpServer) {
  server.registerTool(
    'get_page',
    {
      description:
        'Obtiene una página estática completa por ID, incluyendo el contenido HTML por idioma y los datos SEO. Útil para auditar o revisar el texto de páginas institucionales. Requiere scope read_content.',
      inputSchema: {
        id: z.number().describe('ID de la página.'),
      },
    },
    async ({ id }) => {
      const p = await tnFetch<TNPage>(`/pages/${id}`, V)

      return {
        content: [{
          type: 'text' as const,
          text: `Página ${p.id}:\n\n${JSON.stringify({
            id: p.id,
            nombre: p.name,
            handle: p.handle,
            publicada: p.published,
            seo_title: p.seo_title,
            seo_description: p.seo_description,
            contenido: p.content,
            creada: p.created_at,
            actualizada: p.updated_at,
          }, null, 2)}`,
        }],
      }
    }
  )
}

export function registerCreatePage(server: McpServer) {
  server.registerTool(
    'create_page',
    {
      description:
        'Crea una página estática nueva. Contenido HTML. Por defecto se publica. Requiere scope write_content.',
      inputSchema: {
        title: z.string().describe('Título de la página, ej: "Quiénes Somos".'),
        content: z.string().describe('Contenido HTML de la página.'),
        seo_handle: z.string().optional().describe('Handle/slug URL-friendly. Si se omite, TN lo genera del título.'),
        seo_title: z.string().optional().describe('Título SEO.'),
        seo_description: z.string().optional().describe('Meta description SEO.'),
        published: z.boolean().optional().describe('Publicar de inmediato (default true).'),
        language: z.string().optional().describe('Idioma/locale del contenido (default "es" → se normaliza a "es_AR").'),
      },
    },
    async ({ title, content, seo_handle, seo_title, seo_description, published, language }) => {
      const lang = toLocale(language)
      const i18nEntry: Record<string, string> = { title, content }
      if (seo_handle !== undefined) i18nEntry.seo_handle = seo_handle
      if (seo_title !== undefined) i18nEntry.seo_title = seo_title
      if (seo_description !== undefined) i18nEntry.seo_description = seo_description

      const body = {
        page: {
          publish: published ?? true,
          i18n: { [lang]: i18nEntry },
        },
      }

      const created = await tnFetch<TNPage>('/pages', { ...V, method: 'POST', body })

      return {
        content: [{
          type: 'text' as const,
          text: `Página creada: id ${created.id} ("${pickLocalized(created.name)}"). ` +
            `Handle: ${pickLocalized(created.handle)}. Publicada: ${created.published}.`,
        }],
      }
    }
  )
}

export function registerUpdatePage(server: McpServer) {
  server.registerTool(
    'update_page',
    {
      description:
        'Actualiza una página estática existente (título y/o contenido HTML). Sólo se cambian los campos provistos; el resto se preserva (trae la página actual y mergea). Requiere scope write_content.',
      inputSchema: {
        id: z.number().describe('ID de la página a actualizar.'),
        title: z.string().optional().describe('Nuevo título. Si se omite, se conserva el actual.'),
        content: z.string().optional().describe('Nuevo contenido HTML (reemplaza el actual). Si se omite, se conserva.'),
        published: z.boolean().optional().describe('Publicar u ocultar. Si se omite, se conserva el estado actual.'),
        seo_title: z.string().optional().describe('Nuevo SEO title. Si se omite, se conserva el actual.'),
        seo_description: z.string().optional().describe('Nueva SEO description. Si se omite, se conserva la actual.'),
        language: z.string().optional().describe('Idioma/locale del contenido (default "es" → se normaliza a "es_AR").'),
      },
    },
    async ({ id, title, content, published, seo_title, seo_description, language }) => {
      if (
        title === undefined && content === undefined && published === undefined &&
        seo_title === undefined && seo_description === undefined
      ) {
        return { content: [{ type: 'text' as const, text: 'No se indicó ningún campo para actualizar.' }] }
      }

      const lang = toLocale(language)

      // La API 2025-03 exige title + content en el envelope i18n, así que traemos la
      // página actual y mergeamos: un update parcial no debe vaciar título/contenido/SEO.
      const current = await tnFetch<TNPage>(`/pages/${id}`, V)

      const i18nEntry: Record<string, string> = {
        title: title ?? pickLocalized(current.name),
        content: content ?? pickLocalized(current.content),
      }
      const nextSeoTitle = seo_title ?? pickLocalized(current.seo_title)
      const nextSeoDesc = seo_description ?? pickLocalized(current.seo_description)
      if (nextSeoTitle) i18nEntry.seo_title = nextSeoTitle
      if (nextSeoDesc) i18nEntry.seo_description = nextSeoDesc

      const body = {
        page: {
          publish: published ?? current.published,
          i18n: { [lang]: i18nEntry },
        },
      }

      const updated = await tnFetch<TNPage>(`/pages/${id}`, { ...V, method: 'PUT', body })

      const changed = [
        title !== undefined && 'título',
        content !== undefined && 'contenido',
        published !== undefined && 'publicación',
        seo_title !== undefined && 'seo_title',
        seo_description !== undefined && 'seo_description',
      ].filter(Boolean).join(', ')

      return {
        content: [{
          type: 'text' as const,
          text: `Página ${updated.id} actualizada ("${pickLocalized(updated.name)}"). ` +
            `Campos modificados: ${changed}. Publicada: ${updated.published}.`,
        }],
      }
    }
  )
}

export function registerDeletePage(server: McpServer) {
  server.registerTool(
    'delete_page',
    {
      description:
        'Elimina una página estática. Operación irreversible. Requiere scope write_content.',
      inputSchema: {
        id: z.number().describe('ID de la página a eliminar.'),
      },
    },
    async ({ id }) => {
      await tnFetch(`/pages/${id}`, { ...V, method: 'DELETE' })
      return { content: [{ type: 'text' as const, text: `Página ${id} eliminada.` }] }
    }
  )
}
