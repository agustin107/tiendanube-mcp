// Metafields — Namespaced Key-Value store de TiendaNube/Nuvemshop.
// Docs: https://tiendanube.github.io/api-documentation/resources/metafields
//
// Entidades soportadas (owner_resource, PascalCase en el body):
//   Product, Product_Variant, Category, Page, Order, Customer
// El GET por recurso usa el nombre en plural/minúscula en el path:
//   /metafields/products, /metafields/product_variants, /metafields/categories, ...
//
// Caso de uso principal para KitMaq: PRODUCTOS RELACIONADOS.
// El theme Base lee `product.metafields.related_products.related_products_ids`.
// => namespace "related_products", key "related_products_ids", owner_resource "Product",
//    value = array JSON de IDs de producto (ej: "[123,456]").

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch } from '../client.js'

interface TNMetafield {
  id: number
  namespace: string
  key: string
  value: string
  description?: string
  owner_id: number
  owner_resource: string
  created_at?: string
  updated_at?: string
}

// owner_resource (body, PascalCase) -> segmento del path del GET (plural, minúscula)
const OWNER_RESOURCE_PATH: Record<string, string> = {
  Product: 'products',
  Product_Variant: 'product_variants',
  Category: 'categories',
  Page: 'pages',
  Order: 'orders',
  Customer: 'customers',
}

const ownerResourceEnum = z.enum([
  'Product',
  'Product_Variant',
  'Category',
  'Page',
  'Order',
  'Customer',
])

export function registerListMetafields(server: McpServer) {
  server.registerTool(
    'list_metafields',
    {
      description:
        'Lista metafields de un tipo de entidad. Filtrable por owner_id, namespace y key. ' +
        'owner_resource: Product | Product_Variant | Category | Page | Order | Customer.',
      inputSchema: {
        owner_resource: ownerResourceEnum.describe('Tipo de entidad dueña del metafield.'),
        owner_id: z.number().optional().describe('ID de la entidad dueña (ej: product_id).'),
        namespace: z.string().optional().describe('Filtrar por namespace.'),
        key: z.string().optional().describe('Filtrar por key.'),
        page: z.number().min(1).optional(),
        per_page: z.number().min(1).max(200).optional(),
      },
    },
    async ({ owner_resource, ...params }) => {
      const segment = OWNER_RESOURCE_PATH[owner_resource]
      const metafields = await tnFetch<TNMetafield[]>(`/metafields/${segment}`, {
        params: params as Record<string, string | number | boolean | undefined>,
        emptyArrayOn404: true,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `${metafields.length} metafields (${owner_resource}):\n\n${JSON.stringify(metafields, null, 2)}`,
        }],
      }
    }
  )
}

export function registerCreateMetafield(server: McpServer) {
  server.registerTool(
    'create_metafield',
    {
      description:
        'Crea un metafield en una entidad. key/value/namespace/owner_id/owner_resource son obligatorios. ' +
        'value es siempre string (serializá JSON si necesitás guardar arrays/objetos).',
      inputSchema: {
        owner_resource: ownerResourceEnum.describe('Tipo de entidad dueña.'),
        owner_id: z.number().describe('ID de la entidad dueña.'),
        namespace: z.string().describe('Namespace (empieza con letra; a-z A-Z 0-9 _).'),
        key: z.string().describe('Key (empieza con letra; a-z A-Z 0-9 _).'),
        value: z.string().describe('Valor (string). Para arrays/objetos, pasar JSON.stringify.'),
        description: z.string().optional().describe('Descripción opcional del metafield.'),
      },
    },
    async ({ owner_resource, owner_id, namespace, key, value, description }) => {
      const created = await tnFetch<TNMetafield>('/metafields', {
        method: 'POST',
        body: { owner_resource, owner_id, namespace, key, value, ...(description ? { description } : {}) },
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Metafield creado: id ${created.id} (${created.namespace}.${created.key}) en ${owner_resource} ${owner_id}.`,
        }],
      }
    }
  )
}

export function registerUpdateMetafield(server: McpServer) {
  server.registerTool(
    'update_metafield',
    {
      description: 'Actualiza el value y/o la description de un metafield existente por su id.',
      inputSchema: {
        id: z.number().describe('ID del metafield.'),
        value: z.string().optional().describe('Nuevo valor (string).'),
        description: z.string().optional().describe('Nueva descripción.'),
      },
    },
    async ({ id, value, description }) => {
      const body: Record<string, unknown> = {}
      if (value !== undefined) body.value = value
      if (description !== undefined) body.description = description

      const updated = await tnFetch<TNMetafield>(`/metafields/${id}`, { method: 'PUT', body })

      return {
        content: [{
          type: 'text' as const,
          text: `Metafield ${id} actualizado (${updated.namespace}.${updated.key}). Valor: ${updated.value}`,
        }],
      }
    }
  )
}

export function registerDeleteMetafield(server: McpServer) {
  server.registerTool(
    'delete_metafield',
    {
      description: 'Elimina un metafield por su id.',
      inputSchema: {
        id: z.number().describe('ID del metafield a eliminar.'),
      },
    },
    async ({ id }) => {
      await tnFetch(`/metafields/${id}`, { method: 'DELETE' })
      return {
        content: [{ type: 'text' as const, text: `Metafield ${id} eliminado.` }],
      }
    }
  )
}

export function registerSetRelatedProducts(server: McpServer) {
  server.registerTool(
    'set_related_products',
    {
      description:
        'Setea los productos relacionados (alternativos) de un producto vía Metafields. ' +
        'Escribe namespace "related_products", key "related_products_ids" (owner_resource Product). ' +
        'El theme Base los muestra al pie del detalle del producto. Idempotente: si ya existe el ' +
        'metafield, lo actualiza; si no, lo crea. Pasar related_ids=[] limpia los relacionados.',
      inputSchema: {
        product_id: z.number().describe('ID del producto al que se le setean los relacionados.'),
        related_ids: z.array(z.number()).describe('IDs de los productos relacionados. [] para limpiar.'),
      },
    },
    async ({ product_id, related_ids }) => {
      const NAMESPACE = 'related_products'
      const KEY = 'related_products_ids'
      const value = JSON.stringify(related_ids)

      // Buscar si ya existe el metafield para hacer PUT en vez de POST.
      const existing = await tnFetch<TNMetafield[]>('/metafields/products', {
        params: { owner_id: product_id, namespace: NAMESPACE, key: KEY },
        emptyArrayOn404: true,
      })

      let action: string
      let mfId: number
      if (Array.isArray(existing) && existing.length > 0) {
        mfId = existing[0].id
        await tnFetch(`/metafields/${mfId}`, { method: 'PUT', body: { value } })
        action = 'actualizado'
      } else {
        const created = await tnFetch<TNMetafield>('/metafields', {
          method: 'POST',
          body: {
            owner_resource: 'Product',
            owner_id: product_id,
            namespace: NAMESPACE,
            key: KEY,
            value,
          },
        })
        mfId = created.id
        action = 'creado'
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Relacionados ${action} para producto ${product_id}: ${related_ids.length} productos ` +
            `[${related_ids.join(', ')}] (metafield ${mfId}).`,
        }],
      }
    }
  )
}
