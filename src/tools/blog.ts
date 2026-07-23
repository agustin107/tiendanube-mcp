// Tools de Blog (API 2025-03, /blogs).
// Requiere scopes read_content / write_content en el token.
// Notas de la API:
// - blog_id y post_id son UUIDs (strings).
// - Crear/editar posts usa multipart/form-data (no JSON): campos metadata (JSON), content, published, thumbnail.
// - publish/unpublish son PATCH sin body → 204. delete/update → 204.
// - Las imágenes se suben aparte (media / thumbnail) y devuelven una URL para meter en el post.

import { z } from 'zod'
import { readFile } from 'fs/promises'
import { extname, basename } from 'path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch } from '../client.js'
import type { TNBlog, TNBlogPost, TNBlogPostsResponse } from '../types.js'

const V = { apiVersion: '2025-03' as const }
const ALLOWED_IMAGE_EXTS = ['.gif', '.jpg', '.jpeg', '.png', '.webp']

// Resuelve el blog_id de la tienda (si no se pasa, lo busca vía GET /blogs).
async function resolveBlogId(provided?: string): Promise<string> {
  if (provided) return provided
  const blog = await tnFetch<TNBlog>('/blogs', V)
  if (!blog?.blog_id) throw new Error('No se pudo resolver el blog_id de la tienda (GET /blogs sin resultado).')
  return blog.blog_id
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function registerGetBlog(server: McpServer) {
  server.registerTool(
    'get_blog',
    {
      description:
        'Obtiene el blog de la tienda y su blog_id (UUID), necesario para el resto de las operaciones de blog. Requiere scope read_content.',
    },
    async () => {
      const blog = await tnFetch<TNBlog>('/blogs', V)
      return {
        content: [{
          type: 'text' as const,
          text: `Blog de la tienda:\n\n${JSON.stringify(blog, null, 2)}`,
        }],
      }
    }
  )
}

export function registerListBlogPosts(server: McpServer) {
  server.registerTool(
    'list_blog_posts',
    {
      description:
        'Lista los posts del blog (paginado). Devuelve id, título, handle, estado de publicación y fecha. NO incluye el HTML completo — usar get_blog_post para eso. Requiere scope read_content.',
      inputSchema: {
        blog_id: z.string().optional().describe('UUID del blog. Si se omite, se resuelve automáticamente vía GET /blogs.'),
        page: z.number().min(1).optional().describe('Número de página (1-based, default 1).'),
      },
    },
    async ({ blog_id, page }) => {
      const id = await resolveBlogId(blog_id)
      const resp = await tnFetch<TNBlogPostsResponse>(`/blogs/${id}/posts`, {
        ...V,
        params: page ? { page } : undefined,
      })

      const data = resp?.posts?.data ?? []
      if (data.length === 0) {
        return { content: [{ type: 'text' as const, text: 'El blog no tiene posts (o la página está vacía).' }] }
      }

      const summary = data.map((p) => ({
        post_id: p.post_id,
        titulo: p.data?.[0]?.title ?? '',
        handle: p.data?.[0]?.handle ?? '',
        publicado: p.published_at !== null,
        publicado_en: p.published_at,
        actualizado: p.updated_at,
        idiomas: p.data?.map((d) => d.language) ?? [],
      }))

      const meta = resp.posts.meta
      return {
        content: [{
          type: 'text' as const,
          text: `${summary.length} posts (de ${meta.itemCount} total, página ${meta.page}/${meta.pageCount}):\n\n` +
            JSON.stringify(summary, null, 2),
        }],
      }
    }
  )
}

export function registerGetBlogPost(server: McpServer) {
  server.registerTool(
    'get_blog_post',
    {
      description:
        'Obtiene un post del blog completo por su post_id, incluyendo el contenido HTML por idioma, resumen y datos SEO. Requiere scope read_content.',
      inputSchema: {
        post_id: z.string().describe('UUID del post.'),
        blog_id: z.string().optional().describe('UUID del blog. Si se omite, se resuelve automáticamente.'),
      },
    },
    async ({ post_id, blog_id }) => {
      const id = await resolveBlogId(blog_id)
      const post = await tnFetch<TNBlogPost>(`/blogs/${id}/posts/${post_id}`, V)
      return {
        content: [{
          type: 'text' as const,
          text: `Post ${post.post_id}:\n\n${JSON.stringify(post, null, 2)}`,
        }],
      }
    }
  )
}

export function registerCreateBlogPost(server: McpServer) {
  server.registerTool(
    'create_blog_post',
    {
      description:
        'Crea un post de blog nuevo. Contenido HTML. Por defecto queda como borrador (published=false). El handle se genera del título si no se indica. Requiere scope write_content.',
      inputSchema: {
        title: z.string().describe('Título del post.'),
        content: z.string().optional().describe('Contenido HTML del post.'),
        summary: z.string().optional().describe('Resumen/copete.'),
        handle: z.string().optional().describe('Handle/slug URL-friendly. Si se omite, se genera del título.'),
        seo_title: z.string().optional().describe('Título SEO.'),
        seo_description: z.string().optional().describe('Meta description SEO.'),
        published: z.boolean().optional().describe('Publicar de inmediato (default false = borrador).'),
        thumbnail: z.string().optional().describe('URL de la imagen de portada (subir antes con upload_blog_thumbnail).'),
        language: z.string().optional().describe('Código de idioma (default "es").'),
        blog_id: z.string().optional().describe('UUID del blog. Si se omite, se resuelve automáticamente.'),
      },
    },
    async ({ title, content, summary, handle, seo_title, seo_description, published, thumbnail, language, blog_id }) => {
      const id = await resolveBlogId(blog_id)
      const metadata = {
        language: language || 'es',
        title,
        handle: handle || slugify(title),
        summary: summary ?? '',
        seo_title: seo_title ?? title,
        seo_description: seo_description ?? summary ?? '',
      }

      const form = new FormData()
      form.set('metadata', JSON.stringify(metadata))
      if (content !== undefined) form.set('content', content)
      if (published !== undefined) form.set('published', String(published))
      if (thumbnail !== undefined) form.set('thumbnail', thumbnail)

      const created = await tnFetch<{ post_id: string }>(`/blogs/${id}/posts`, {
        ...V,
        method: 'POST',
        body: form,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Post creado: post_id ${created.post_id} ("${title}"). ` +
            `Publicado: ${published ?? false}. Handle: ${metadata.handle}.`,
        }],
      }
    }
  )
}

export function registerUpdateBlogPost(server: McpServer) {
  server.registerTool(
    'update_blog_post',
    {
      description:
        'Actualiza un post de blog existente (metadata + contenido HTML). La metadata reemplaza a la anterior, así que conviene traer el post con get_blog_post y reenviar los campos. Requiere scope write_content.',
      inputSchema: {
        post_id: z.string().describe('UUID del post a actualizar.'),
        title: z.string().describe('Título del post.'),
        content: z.string().optional().describe('Contenido HTML (reemplaza el actual).'),
        summary: z.string().optional().describe('Resumen/copete.'),
        handle: z.string().optional().describe('Handle/slug. Si se omite, se genera del título.'),
        seo_title: z.string().optional().describe('Título SEO.'),
        seo_description: z.string().optional().describe('Meta description SEO.'),
        published: z.boolean().optional().describe('Estado de publicación.'),
        thumbnail: z.string().optional().describe('URL de la imagen de portada.'),
        language: z.string().optional().describe('Código de idioma (default "es").'),
        blog_id: z.string().optional().describe('UUID del blog. Si se omite, se resuelve automáticamente.'),
      },
    },
    async ({ post_id, title, content, summary, handle, seo_title, seo_description, published, thumbnail, language, blog_id }) => {
      const id = await resolveBlogId(blog_id)
      const metadata = {
        language: language || 'es',
        title,
        handle: handle || slugify(title),
        summary: summary ?? '',
        seo_title: seo_title ?? title,
        seo_description: seo_description ?? summary ?? '',
      }

      const form = new FormData()
      form.set('metadata', JSON.stringify(metadata))
      if (content !== undefined) form.set('content', content)
      if (published !== undefined) form.set('published', String(published))
      if (thumbnail !== undefined) form.set('thumbnail', thumbnail)

      await tnFetch(`/blogs/${id}/posts/${post_id}`, { ...V, method: 'PUT', body: form })

      return {
        content: [{
          type: 'text' as const,
          text: `Post ${post_id} actualizado ("${title}").`,
        }],
      }
    }
  )
}

export function registerPublishBlogPost(server: McpServer) {
  server.registerTool(
    'publish_blog_post',
    {
      description: 'Publica un post de blog (lo hace visible). Requiere scope write_content.',
      inputSchema: {
        post_id: z.string().describe('UUID del post.'),
        blog_id: z.string().optional().describe('UUID del blog. Si se omite, se resuelve automáticamente.'),
      },
    },
    async ({ post_id, blog_id }) => {
      const id = await resolveBlogId(blog_id)
      await tnFetch(`/blogs/${id}/posts/${post_id}/publish`, { ...V, method: 'PATCH' })
      return { content: [{ type: 'text' as const, text: `Post ${post_id} publicado.` }] }
    }
  )
}

export function registerUnpublishBlogPost(server: McpServer) {
  server.registerTool(
    'unpublish_blog_post',
    {
      description: 'Despublica un post de blog (lo deja como borrador, oculto al público). Requiere scope write_content.',
      inputSchema: {
        post_id: z.string().describe('UUID del post.'),
        blog_id: z.string().optional().describe('UUID del blog. Si se omite, se resuelve automáticamente.'),
      },
    },
    async ({ post_id, blog_id }) => {
      const id = await resolveBlogId(blog_id)
      await tnFetch(`/blogs/${id}/posts/${post_id}/unpublish`, { ...V, method: 'PATCH' })
      return { content: [{ type: 'text' as const, text: `Post ${post_id} despublicado (borrador).` }] }
    }
  )
}

export function registerDeleteBlogPost(server: McpServer) {
  server.registerTool(
    'delete_blog_post',
    {
      description: 'Elimina un post de blog de forma permanente. Operación irreversible. Requiere scope write_content.',
      inputSchema: {
        post_id: z.string().describe('UUID del post a eliminar.'),
        blog_id: z.string().optional().describe('UUID del blog. Si se omite, se resuelve automáticamente.'),
      },
    },
    async ({ post_id, blog_id }) => {
      const id = await resolveBlogId(blog_id)
      await tnFetch(`/blogs/${id}/posts/${post_id}`, { ...V, method: 'DELETE' })
      return { content: [{ type: 'text' as const, text: `Post ${post_id} eliminado.` }] }
    }
  )
}

// Helper: subir un archivo de imagen a un endpoint multipart y devolver la URL resultante.
async function uploadBlogImage(
  blogId: string,
  filePath: string,
  fieldName: 'media' | 'image'
): Promise<Record<string, string>> {
  const ext = extname(filePath).toLowerCase()
  if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
    throw new Error(`Extensión no permitida: ${ext}. Usar: ${ALLOWED_IMAGE_EXTS.join(', ')}`)
  }
  const buffer = await readFile(filePath)
  const form = new FormData()
  const endpoint = fieldName === 'media' ? 'media' : 'thumbnail'
  form.set(fieldName, new Blob([buffer]), basename(filePath))
  return tnFetch<Record<string, string>>(`/blogs/${blogId}/posts/${endpoint}`, {
    ...V,
    method: 'POST',
    body: form,
  })
}

export function registerUploadBlogMedia(server: McpServer) {
  server.registerTool(
    'upload_blog_media',
    {
      description:
        'Sube una imagen de contenido para usar DENTRO del HTML de un post. Devuelve la URL; hay que insertarla en el `content` del post (create/update). Formatos: .gif .jpg .png .webp. Requiere scope write_content.',
      inputSchema: {
        file_path: z.string().describe('Ruta absoluta al archivo de imagen local.'),
        blog_id: z.string().optional().describe('UUID del blog. Si se omite, se resuelve automáticamente.'),
      },
    },
    async ({ file_path, blog_id }) => {
      const id = await resolveBlogId(blog_id)
      const res = await uploadBlogImage(id, file_path, 'media')
      return {
        content: [{
          type: 'text' as const,
          text: `Imagen subida. media_url:\n${res.media_url ?? JSON.stringify(res)}`,
        }],
      }
    }
  )
}

export function registerUploadBlogThumbnail(server: McpServer) {
  server.registerTool(
    'upload_blog_thumbnail',
    {
      description:
        'Sube la imagen de portada (thumbnail) de un post. Devuelve la URL; usarla en el campo `thumbnail` de create_blog_post o update_blog_post. Formatos: .gif .jpg .png .webp. Requiere scope write_content.',
      inputSchema: {
        file_path: z.string().describe('Ruta absoluta al archivo de imagen local.'),
        blog_id: z.string().optional().describe('UUID del blog. Si se omite, se resuelve automáticamente.'),
      },
    },
    async ({ file_path, blog_id }) => {
      const id = await resolveBlogId(blog_id)
      const res = await uploadBlogImage(id, file_path, 'image')
      return {
        content: [{
          type: 'text' as const,
          text: `Thumbnail subido. thumbnail_url:\n${res.thumbnail_url ?? JSON.stringify(res)}`,
        }],
      }
    }
  )
}
