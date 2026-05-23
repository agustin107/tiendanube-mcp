import { z } from 'zod'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch } from '../client.js'
import type { TNImage } from '../types.js'

const ALLOWED_IMAGE_EXTS = ['.gif', '.jpg', '.jpeg', '.png', '.webp']

type ImageInput = {
  src?: string
  file_path?: string
  filename?: string
  position?: number
  alt?: Record<string, string>
}

type PreparedBody = { body: Record<string, unknown> } | { error: string }

async function buildImageBody(img: ImageInput): Promise<PreparedBody> {
  if (!img.src && !img.file_path) return { error: 'Debe proveer src o file_path.' }
  if (img.src && img.file_path) return { error: 'Proveer src o file_path, no ambos.' }

  const body: Record<string, unknown> = {}

  if (img.src) {
    body.src = img.src
  } else {
    if (!img.filename) return { error: 'filename es requerido cuando se usa file_path.' }
    const ext = extname(img.filename).toLowerCase()
    if (!ALLOWED_IMAGE_EXTS.includes(ext))
      return { error: `Extensión no permitida: ${ext}. Usar: ${ALLOWED_IMAGE_EXTS.join(', ')}` }
    const fileBuffer = await readFile(img.file_path!)
    body.attachment = fileBuffer.toString('base64')
    body.filename = img.filename
  }

  if (img.position !== undefined) body.position = img.position
  if (img.alt !== undefined) body.alt = img.alt

  return { body }
}

export function registerAddProductImages(server: McpServer) {
  server.registerTool(
    'add_product_images',
    {
      description:
        'Agrega una o más imágenes a un producto existente. Cada imagen puede venir de una URL pública (src) o de un archivo local (file_path). Máx 250 imágenes por producto, máx 10 MB por imagen (.gif, .jpg, .png, .webp). Los errores por imagen no abortan el resto del lote.',
      inputSchema: {
        product_id: z.number().describe('ID del producto al que se agregan las imágenes.'),
        images: z
          .array(
            z.object({
              src: z.string().optional().describe(
                'URL pública de la imagen. Usar src o file_path, no ambos.'
              ),
              file_path: z.string().optional().describe(
                'Ruta absoluta al archivo local, ej: /Users/me/foto.jpg. Requiere también filename.'
              ),
              filename: z.string().optional().describe(
                'Nombre del archivo (requerido si se usa file_path), ej: foto.jpg.'
              ),
              position: z.number().optional().describe('Posición 1-based en la lista de imágenes del producto.'),
              alt: z.record(z.string()).optional().describe(
                'Alt text multilenguaje, ej: { es: "Descripción", en: "Description" }.'
              ),
            })
          )
          .min(1)
          .describe('Lista de imágenes a agregar. Mínimo 1 elemento.'),
      },
    },
    async ({ product_id, images }) => {
      const results: Array<{ index: number; ok: boolean; image_id?: number; error?: string }> = []

      for (let i = 0; i < images.length; i++) {
        const prepared = await buildImageBody(images[i])
        if ('error' in prepared) {
          results.push({ index: i, ok: false, error: prepared.error })
          continue
        }
        try {
          const created = await tnFetch<TNImage>(`/products/${product_id}/images`, {
            method: 'POST',
            body: prepared.body,
          })
          results.push({ index: i, ok: true, image_id: created.id })
        } catch (err) {
          results.push({ index: i, ok: false, error: (err as Error).message })
        }
      }

      const succeeded = results.filter(r => r.ok).length
      const failed = results.filter(r => !r.ok).length

      const lines = [
        `Imágenes procesadas: ${succeeded} ok, ${failed} error(es).`,
        ...results.map(r =>
          r.ok
            ? `  [${r.index}] ✓ image_id=${r.image_id}`
            : `  [${r.index}] ✗ ${r.error}`
        ),
      ]

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    }
  )
}

export function registerListProductImages(server: McpServer) {
  server.registerTool(
    'list_product_images',
    {
      description: 'Lista todas las imágenes de un producto con id, src, posición y alt text.',
      inputSchema: {
        product_id: z.number().describe('ID del producto.'),
      },
    },
    async ({ product_id }) => {
      const images = await tnFetch<TNImage[]>(`/products/${product_id}/images`)

      return {
        content: [{
          type: 'text' as const,
          text: images.length === 0
            ? `El producto ${product_id} no tiene imágenes.`
            : JSON.stringify(images, null, 2),
        }],
      }
    }
  )
}

export function registerDeleteProductImage(server: McpServer) {
  server.registerTool(
    'delete_product_image',
    {
      description: 'Elimina una imagen de un producto. Operación destructiva e irreversible.',
      inputSchema: {
        product_id: z.number().describe('ID del producto.'),
        image_id: z.number().describe('ID de la imagen a eliminar.'),
      },
    },
    async ({ product_id, image_id }) => {
      await tnFetch(`/products/${product_id}/images/${image_id}`, {
        method: 'DELETE',
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Imagen ${image_id} del producto ${product_id} eliminada.`,
        }],
      }
    }
  )
}

export function registerUpdateProductImage(server: McpServer) {
  server.registerTool(
    'update_product_image',
    {
      description: 'Actualiza la posición o el alt text de una imagen existente en un producto.',
      inputSchema: {
        product_id: z.number().describe('ID del producto.'),
        image_id: z.number().describe('ID de la imagen a actualizar.'),
        position: z.number().optional().describe('Nueva posición 1-based en la lista.'),
        alt: z.record(z.string()).optional().describe(
          'Alt text multilenguaje, ej: { es: "texto", en: "text" }.'
        ),
      },
    },
    async ({ product_id, image_id, ...body }) => {
      const cleaned = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined)
      )

      const updated = await tnFetch<TNImage>(
        `/products/${product_id}/images/${image_id}`,
        { method: 'PUT', body: cleaned }
      )

      return {
        content: [{
          type: 'text' as const,
          text: `Imagen ${updated.id} (producto ${product_id}) actualizada. Posición: ${updated.position}.`,
        }],
      }
    }
  )
}
