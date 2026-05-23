import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, tnFetchWithMeta, pickLocalized } from '../client.js'
import type { TNProduct } from '../types.js'

export function registerListProducts(server: McpServer) {
  server.registerTool(
    'list_products',
    {
      description: 'Lista productos de la tienda con filtros por stock, precio, categoría, publicación y fecha. Soporta paginación (per_page máx 200, default 30).',
      inputSchema: {
        q: z.string().optional().describe('Texto de búsqueda (nombre, tags o SKU).'),
        category_id: z.number().optional().describe('Filtrar por categoría (id).'),
        published: z.boolean().optional().describe('true=publicados, false=ocultos.'),
        free_shipping: z.boolean().optional().describe('Productos con envío gratis.'),
        min_stock: z.number().optional().describe('Stock mínimo disponible.'),
        max_stock: z.number().optional().describe('Stock máximo disponible.'),
        created_at_min: z.string().optional().describe('Fecha creación desde (ISO 8601).'),
        created_at_max: z.string().optional().describe('Fecha creación hasta (ISO 8601).'),
        updated_at_min: z.string().optional().describe('Fecha última actualización desde (ISO 8601).'),
        page: z.number().min(1).optional().describe('Página (default 1).'),
        per_page: z.number().min(1).max(200).optional().describe('Resultados por página (default 30).'),
        sort_by: z.enum([
          'user',
          'price-ascending',
          'price-descending',
          'alpha-ascending',
          'alpha-descending',
          'created-at-ascending',
          'created-at-descending',
          'best-selling',
        ]).optional().describe('Orden de resultados.'),
      },
    },
    async (args) => {
      const { data: products, totalCount } = await tnFetchWithMeta<TNProduct[]>(
        '/products',
        { params: args as Record<string, string | number | boolean | undefined> }
      )

      if (!products || products.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No se encontraron productos con los filtros indicados.' }] }
      }

      const summary = products.map(p => {
        const firstVariant = p.variants?.[0]
        return {
          id: p.id,
          nombre: pickLocalized(p.name),
          handle: pickLocalized(p.handle),
          publicado: p.published,
          precio: firstVariant?.price ?? null,
          precio_promocional: firstVariant?.promotional_price ?? null,
          stock: firstVariant?.stock ?? null,
          sku: firstVariant?.sku ?? null,
          variantes: p.variants?.length ?? 0,
          categorias: (p.categories ?? []).map(c => pickLocalized(c.name)),
          tags: p.tags,
          actualizado: p.updated_at,
        }
      })

      return {
        content: [{
          type: 'text' as const,
          text: `${summary.length} productos${totalCount ? ` (de ${totalCount} total)` : ''}:\n\n` +
            JSON.stringify(summary, null, 2),
        }],
      }
    }
  )
}

export function registerGetProduct(server: McpServer) {
  server.registerTool(
    'get_product',
    {
      description: 'Obtiene un producto completo por id (o por SKU si se pasa by_sku=true). Incluye variantes, imágenes y categorías.',
      inputSchema: {
        id: z.string().describe('ID del producto (o SKU si by_sku=true).'),
        by_sku: z.boolean().optional().describe('Si es true, se interpreta `id` como SKU de variante.'),
      },
    },
    async ({ id, by_sku }) => {
      const path = by_sku ? `/products/sku/${encodeURIComponent(id)}` : `/products/${id}`
      const product = await tnFetch<TNProduct>(path)

      const detail = {
        id: product.id,
        nombre: pickLocalized(product.name),
        descripcion: pickLocalized(product.description),
        handle: pickLocalized(product.handle),
        publicado: product.published,
        marca: product.brand,
        tags: product.tags,
        envio_gratis: product.free_shipping,
        requiere_envio: product.requires_shipping,
        categorias: (product.categories ?? []).map(c => ({ id: c.id, nombre: pickLocalized(c.name) })),
        variantes: (product.variants ?? []).map(v => ({
          id: v.id,
          precio: v.price,
          precio_promocional: v.promotional_price,
          stock: v.stock,
          sku: v.sku,
          peso: v.weight,
          valores: v.values?.map(val => pickLocalized(val)),
        })),
        imagenes: (product.images ?? []).map(img => ({ id: img.id, src: img.src, posicion: img.position })),
        creado: product.created_at,
        actualizado: product.updated_at,
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Producto ${product.id}:\n\n${JSON.stringify(detail, null, 2)}`,
        }],
      }
    }
  )
}

export function registerUpdateProduct(server: McpServer) {
  server.registerTool(
    'update_product',
    {
      description: 'Actualiza atributos de un producto (precio/stock de variantes, nombre, descripción, tags, publicación). Las variantes se pasan en el array `variants` con su id. Retorna el producto actualizado.',
      inputSchema: {
        id: z.number().describe('ID del producto a actualizar.'),
        name: z.record(z.string()).optional().describe('Nombre por idioma, ej: { es: "Nuevo nombre" }.'),
        description: z.record(z.string()).optional().describe('Descripción HTML por idioma.'),
        handle: z.record(z.string()).optional().describe('URL handle por idioma.'),
        published: z.boolean().optional().describe('Publicar u ocultar.'),
        free_shipping: z.boolean().optional().describe('Marcar con envío gratis.'),
        brand: z.string().optional().describe('Marca.'),
        tags: z.string().optional().describe('Tags separados por coma.'),
        seo_title: z.record(z.string()).optional().describe('SEO title por idioma (máx 70 chars).'),
        seo_description: z.record(z.string()).optional().describe('SEO description por idioma (máx 320 chars).'),
        variants: z.array(z.object({
          id: z.number().describe('ID de la variante a actualizar.'),
          price: z.union([z.string(), z.number()]).optional(),
          promotional_price: z.union([z.string(), z.number()]).optional().nullable(),
          stock: z.number().optional().describe('Stock. Usar null para stock infinito.').nullable(),
          sku: z.string().optional().nullable(),
          weight: z.union([z.string(), z.number()]).optional(),
        })).optional().describe('Variantes a actualizar (cada una requiere id).'),
        categories: z.array(z.number()).optional().describe('IDs de categorías (reemplaza las actuales).'),
      },
    },
    async ({ id, ...body }) => {
      // TN acepta PUT con solo los campos a cambiar
      const cleaned = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined)
      )

      const updated = await tnFetch<TNProduct>(`/products/${id}`, {
        method: 'PUT',
        body: cleaned,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Producto ${updated.id} actualizado ("${pickLocalized(updated.name)}").\n` +
            `Campos modificados: ${Object.keys(cleaned).join(', ') || 'ninguno'}.\n` +
            `Última actualización: ${updated.updated_at}`,
        }],
      }
    }
  )
}

export function registerCreateProduct(server: McpServer) {
  server.registerTool(
    'create_product',
    {
      description: 'Crea un producto nuevo con sus variantes. `name` y `variants` son obligatorios. Soporta objetos multilenguaje { es, pt, en }. Para imágenes, cada item debe ser { src: "https://..." }. Cada variante mínima necesita `price`; `stock` ausente = stock ilimitado. Si el producto tiene atributos, las variantes deben incluir `values` (lista de objetos multilenguaje, uno por atributo). Límite: 100k productos por tienda, 1000 variantes por producto, 3 atributos.',
      inputSchema: {
        name: z.record(z.string()).describe('Nombre por idioma, ej: { es: "Taladro Bosch" }. Obligatorio.'),
        variants: z.array(z.object({
          price: z.union([z.string(), z.number()]).describe('Precio (string recomendado, ej "29.99").'),
          promotional_price: z.union([z.string(), z.number()]).optional().nullable(),
          stock: z.number().optional().nullable().describe('Cantidad de stock. Omitir para stock ilimitado.'),
          sku: z.string().optional(),
          barcode: z.string().optional().describe('GTIN/EAN/ISBN.'),
          mpn: z.string().optional().describe('Manufacturer Part Number.'),
          weight: z.union([z.string(), z.number()]).optional().describe('Peso en kg.'),
          width: z.union([z.string(), z.number()]).optional().describe('Ancho en cm.'),
          height: z.union([z.string(), z.number()]).optional().describe('Alto en cm.'),
          depth: z.union([z.string(), z.number()]).optional().describe('Profundidad en cm.'),
          cost: z.union([z.string(), z.number()]).optional().describe('Costo (debe ser > 0).'),
          values: z.array(z.record(z.string())).optional().describe('Valores de atributos por idioma, ej: [{ es: "Rojo" }, { es: "Grande" }]. Necesario si hay atributos.'),
        })).min(1).describe('Lista de variantes. Mínimo 1.'),
        description: z.record(z.string()).optional().describe('Descripción HTML por idioma.'),
        handle: z.record(z.string()).optional().describe('URL handle por idioma (si se omite TN lo genera del nombre).'),
        attributes: z.array(z.record(z.string())).optional().describe('Atributos del producto, ej: [{ es: "Color" }, { es: "Tamaño" }]. Máx 3.'),
        categories: z.array(z.number()).optional().describe('IDs de categorías.'),
        images: z.array(z.object({
          src: z.string().url().describe('URL pública de la imagen.'),
        })).optional().describe('Imágenes del producto. Recomendado max 9 por llamada.'),
        published: z.boolean().optional().describe('Publicar (default true).'),
        free_shipping: z.boolean().optional(),
        video_url: z.string().optional().describe('URL HTTPS de YouTube.'),
        seo_title: z.record(z.string()).optional(),
        seo_description: z.record(z.string()).optional(),
        brand: z.string().optional(),
        tags: z.string().optional().describe('Tags separados por coma.'),
      },
    },
    async (args) => {
      const cleaned = Object.fromEntries(
        Object.entries(args).filter(([, v]) => v !== undefined)
      )

      const created = await tnFetch<TNProduct>('/products', {
        method: 'POST',
        body: cleaned,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Producto creado: id ${created.id} ("${pickLocalized(created.name)}").\n` +
            `Variantes: ${created.variants?.length ?? 0}. Handle: ${pickLocalized(created.handle)}. Publicado: ${created.published}.\n` +
            `Creado: ${created.created_at}`,
        }],
      }
    }
  )
}

export function registerDeleteProduct(server: McpServer) {
  server.registerTool(
    'delete_product',
    {
      description: 'Elimina un producto de la tienda. Operación destructiva: elimina el producto y todas sus variantes/imágenes. No se puede deshacer.',
      inputSchema: {
        id: z.number().describe('ID del producto a eliminar.'),
      },
    },
    async ({ id }) => {
      await tnFetch(`/products/${id}`, { method: 'DELETE' })

      return {
        content: [{
          type: 'text' as const,
          text: `Producto ${id} eliminado.`,
        }],
      }
    }
  )
}

export function registerUpdateProductStockPrice(server: McpServer) {
  server.registerTool(
    'update_product_stock_price',
    {
      description: 'Actualiza stock y/o precio de múltiples variantes en una sola llamada (PATCH /products/stock-price). Máx 50 items por request. Cada item indica el `id` del producto y un array `variants` con los cambios. Ideal para sincronizar precios desde un catálogo externo (CSV, Sheets).',
      inputSchema: {
        updates: z.array(z.object({
          id: z.number().describe('ID del producto.'),
          variants: z.array(z.object({
            id: z.number().describe('ID de la variante.'),
            price: z.union([z.string(), z.number()]).optional().describe('Nuevo precio.'),
            promotional_price: z.union([z.string(), z.number()]).optional().nullable(),
            inventory_levels: z.array(z.object({
              stock: z.number().describe('Cantidad de stock.'),
            })).optional().describe('Niveles de inventario (multi-warehouse). Default 1 nivel.'),
          })).describe('Variantes del producto a actualizar.'),
        })).min(1).max(50).describe('Lista de productos a actualizar (máx 50).'),
      },
    },
    async ({ updates }) => {
      const result = await tnFetch<unknown>('/products/stock-price', {
        method: 'PATCH',
        body: updates,
      })

      const totalProducts = updates.length
      const totalVariants = updates.reduce((sum, u) => sum + u.variants.length, 0)

      return {
        content: [{
          type: 'text' as const,
          text: `Bulk update enviado: ${totalProducts} producto(s), ${totalVariants} variante(s).\n\nRespuesta:\n${JSON.stringify(result, null, 2)}`,
        }],
      }
    }
  )
}
