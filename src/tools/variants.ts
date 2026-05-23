// CRUD de variantes individuales.
// TN expone /products/{product_id}/variants/{variant_id} para gestión por variante.
// Para bulk de precio/stock usar update_product_stock_price en products.ts.

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch } from '../client.js'
import type { TNVariant } from '../types.js'

export function registerCreateProductVariant(server: McpServer) {
  server.registerTool(
    'create_product_variant',
    {
      description: 'Crea una variante nueva para un producto existente. `values` es obligatorio y debe matchear la cantidad/orden de atributos del producto. Combinaciones de valores deben ser únicas. Máx 1000 variantes por producto. `stock_management` lo setea TN automáticamente.',
      inputSchema: {
        product_id: z.number().describe('ID del producto al que pertenece la variante.'),
        values: z.array(z.record(z.string())).describe('Valores de atributos por idioma, ej: [{ es: "Rojo" }, { es: "Grande" }]. Uno por cada atributo del producto.'),
        price: z.union([z.string(), z.number()]).optional().describe('Precio (omitir o null para producto sólo-contacto).'),
        promotional_price: z.union([z.string(), z.number()]).optional().nullable(),
        stock: z.number().optional().nullable().describe('Cantidad de stock. Omitir o null para ilimitado.'),
        sku: z.string().optional(),
        barcode: z.string().optional().describe('GTIN/EAN/ISBN.'),
        mpn: z.string().optional().describe('Manufacturer Part Number.'),
        weight: z.union([z.string(), z.number()]).optional().describe('Peso en kg.'),
        width: z.union([z.string(), z.number()]).optional().describe('Ancho en cm.'),
        height: z.union([z.string(), z.number()]).optional().describe('Alto en cm.'),
        depth: z.union([z.string(), z.number()]).optional().describe('Profundidad en cm.'),
        cost: z.union([z.string(), z.number()]).optional().describe('Costo (> 0).'),
        age_group: z.enum(['newborn', 'infant', 'toddler', 'kids', 'adult']).optional(),
        gender: z.enum(['female', 'male', 'unisex']).optional(),
        image_id: z.number().optional().describe('ID de imagen del producto a asociar.'),
      },
    },
    async ({ product_id, ...body }) => {
      const cleaned = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined)
      )

      const created = await tnFetch<TNVariant>(`/products/${product_id}/variants`, {
        method: 'POST',
        body: cleaned,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Variante creada: id ${created.id} (producto ${created.product_id}). ` +
            `Precio: ${created.price}, stock: ${created.stock ?? 'ilimitado'}, sku: ${created.sku ?? '—'}.`,
        }],
      }
    }
  )
}

export function registerUpdateProductVariant(server: McpServer) {
  server.registerTool(
    'update_product_variant',
    {
      description: 'Actualiza una variante existente. Sólo los campos provistos se modifican. Para stock ilimitado pasar stock=null.',
      inputSchema: {
        product_id: z.number().describe('ID del producto.'),
        variant_id: z.number().describe('ID de la variante.'),
        values: z.array(z.record(z.string())).optional().describe('Nuevos valores de atributos.'),
        price: z.union([z.string(), z.number()]).optional(),
        promotional_price: z.union([z.string(), z.number()]).optional().nullable(),
        stock: z.number().optional().nullable().describe('Stock. null para ilimitado.'),
        sku: z.string().optional().nullable(),
        barcode: z.string().optional().nullable(),
        mpn: z.string().optional().nullable(),
        weight: z.union([z.string(), z.number()]).optional(),
        width: z.union([z.string(), z.number()]).optional(),
        height: z.union([z.string(), z.number()]).optional(),
        depth: z.union([z.string(), z.number()]).optional(),
        cost: z.union([z.string(), z.number()]).optional(),
        age_group: z.enum(['newborn', 'infant', 'toddler', 'kids', 'adult']).optional(),
        gender: z.enum(['female', 'male', 'unisex']).optional(),
        image_id: z.number().optional().nullable(),
      },
    },
    async ({ product_id, variant_id, ...body }) => {
      const cleaned = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined)
      )

      const updated = await tnFetch<TNVariant>(
        `/products/${product_id}/variants/${variant_id}`,
        { method: 'PUT', body: cleaned }
      )

      return {
        content: [{
          type: 'text' as const,
          text: `Variante ${updated.id} (producto ${updated.product_id}) actualizada.\n` +
            `Campos modificados: ${Object.keys(cleaned).join(', ') || 'ninguno'}.\n` +
            `Precio: ${updated.price}, stock: ${updated.stock ?? 'ilimitado'}.`,
        }],
      }
    }
  )
}

export function registerDeleteProductVariant(server: McpServer) {
  server.registerTool(
    'delete_product_variant',
    {
      description: 'Elimina una variante de un producto. Operación destructiva. Considerá update_product_variant con stock=0 si querés "ocultarla" sin perder la referencia.',
      inputSchema: {
        product_id: z.number().describe('ID del producto.'),
        variant_id: z.number().describe('ID de la variante a eliminar.'),
      },
    },
    async ({ product_id, variant_id }) => {
      await tnFetch(`/products/${product_id}/variants/${variant_id}`, {
        method: 'DELETE',
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Variante ${variant_id} del producto ${product_id} eliminada.`,
        }],
      }
    }
  )
}
