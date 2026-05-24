// CRUD de variantes individuales.
// TN expone /products/{product_id}/variants/{variant_id} para gestión por variante.
// Para bulk de precio/stock usar update_product_stock_price en products.ts.

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch } from '../client.js'
import type { TNVariant } from '../types.js'

export function registerListProductVariants(server: McpServer) {
  server.registerTool(
    'list_product_variants',
    {
      description: 'Lista todas las variantes de un producto. Soporta filtros por fecha y since_id.',
      inputSchema: {
        product_id: z.number().describe('ID del producto.'),
        since_id: z.number().optional().describe('Variantes con id mayor a este valor.'),
        created_at_min: z.string().optional().describe('Creadas desde (ISO 8601).'),
        created_at_max: z.string().optional().describe('Creadas hasta (ISO 8601).'),
        updated_at_min: z.string().optional().describe('Actualizadas desde (ISO 8601).'),
        updated_at_max: z.string().optional().describe('Actualizadas hasta (ISO 8601).'),
      },
    },
    async ({ product_id, ...params }) => {
      const variants = await tnFetch<TNVariant[]>(
        `/products/${product_id}/variants`,
        { params: params as Record<string, string | number | boolean | undefined> }
      )

      return {
        content: [{
          type: 'text' as const,
          text: `${variants.length} variantes del producto ${product_id}:\n\n${JSON.stringify(variants, null, 2)}`,
        }],
      }
    }
  )
}

export function registerGetProductVariant(server: McpServer) {
  server.registerTool(
    'get_product_variant',
    {
      description: 'Obtiene una variante específica de un producto por ID.',
      inputSchema: {
        product_id: z.number().describe('ID del producto.'),
        variant_id: z.number().describe('ID de la variante.'),
      },
    },
    async ({ product_id, variant_id }) => {
      const variant = await tnFetch<TNVariant>(`/products/${product_id}/variants/${variant_id}`)

      return {
        content: [{
          type: 'text' as const,
          text: `Variante ${variant.id} (producto ${variant.product_id}):\n\n${JSON.stringify(variant, null, 2)}`,
        }],
      }
    }
  )
}

export function registerReplaceAllProductVariants(server: McpServer) {
  server.registerTool(
    'replace_all_product_variants',
    {
      description: 'Reemplaza TODA la colección de variantes de un producto (operación destructiva). Crea nuevas variantes, actualiza las que coinciden y ELIMINA las que no están en la lista. Para updates no-destructivos, usar batch_update_product_variants.',
      inputSchema: {
        product_id: z.number().describe('ID del producto.'),
        variants: z.array(z.record(z.unknown())).describe('Lista completa de variantes. Cada variante requiere "values" (array de objetos multilenguaje) más campos opcionales como price, stock, sku.'),
      },
    },
    async ({ product_id, variants }) => {
      const result = await tnFetch<TNVariant[]>(`/products/${product_id}/variants`, {
        method: 'PUT',
        body: variants,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Variantes del producto ${product_id} reemplazadas. ${Array.isArray(result) ? result.length : '?'} variantes activas.`,
        }],
      }
    }
  )
}

export function registerBatchUpdateProductVariants(server: McpServer) {
  server.registerTool(
    'batch_update_product_variants',
    {
      description: 'Actualiza múltiples variantes de un producto sin eliminar las no enviadas (no-destructivo). Cada variante debe incluir el campo "id" (ID de variante).',
      inputSchema: {
        product_id: z.number().describe('ID del producto.'),
        variants: z.array(z.record(z.unknown())).describe('Variantes a actualizar. Cada objeto debe incluir "id" (ID de variante) + campos a modificar (price, stock, sku, etc.).'),
      },
    },
    async ({ product_id, variants }) => {
      const result = await tnFetch<TNVariant[]>(`/products/${product_id}/variants`, {
        method: 'PATCH',
        body: variants,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Variantes del producto ${product_id} actualizadas. Colección completa: ${Array.isArray(result) ? result.length : '?'} variantes.`,
        }],
      }
    }
  )
}

export function registerUpdateVariantStock(server: McpServer) {
  server.registerTool(
    'update_variant_stock',
    {
      description: 'Actualiza el stock de una o todas las variantes de un producto. action="replace" para valor absoluto (null=ilimitado); action="variation" para sumar/restar. Sin variant_id aplica a todas las variantes.',
      inputSchema: {
        product_id: z.number().describe('ID del producto.'),
        action: z.enum(['replace', 'variation']).describe('"replace": setea stock absoluto. "variation": agrega o resta cantidad.'),
        value: z.number().nullable().describe('Cantidad. null con action="replace" para stock ilimitado.'),
        variant_id: z.number().optional().describe('ID de variante específica. Omitir para actualizar todas las variantes del producto.'),
      },
    },
    async ({ product_id, action, value, variant_id }) => {
      const body: Record<string, unknown> = { action, value }
      if (variant_id !== undefined) body.id = variant_id

      await tnFetch(`/products/${product_id}/variants/stock`, {
        method: 'POST',
        body,
      })

      const scope = variant_id ? `variante ${variant_id}` : 'todas las variantes'
      return {
        content: [{
          type: 'text' as const,
          text: `Stock actualizado (${action}=${value ?? 'ilimitado'}) para ${scope} del producto ${product_id}.`,
        }],
      }
    }
  )
}

export function registerSetVariantExtraShippingDays(server: McpServer) {
  server.registerTool(
    'set_variant_extra_shipping_days',
    {
      description: 'Setea días adicionales de envío para una variante vía Metafields. Útil para productos que requieren fabricación o preparación extra antes de despachar.',
      inputSchema: {
        variant_id: z.number().describe('ID de la variante.'),
        additional_days: z.number().int().min(0).describe('Días extra de envío (ej: 5).'),
      },
    },
    async ({ variant_id, additional_days }) => {
      await tnFetch('/metafields', {
        method: 'POST',
        body: {
          key: 'additional_days',
          value: String(additional_days),
          namespace: 'shipping_rules',
          owner_id: variant_id,
          owner_resource: 'Product_Variant',
        },
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Días extra de envío seteados: ${additional_days} días para variante ${variant_id}.`,
        }],
      }
    }
  )
}

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
