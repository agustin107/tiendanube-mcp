// Engine-owned writes lock.
//
// KitMaq's internal system (pricing engine + runner) is the only writer of price,
// stock, product creation/deletion and product content (name, description, images,
// variants) in Tienda Nube. The tools below stay registered but refuse at call time
// unless KITMAQ_ESCRITURAS_MOTOR=permitir, so a session cannot silently make the
// store diverge from the engine.
//
// index.ts wraps the McpServer with guardServer() before the register* calls.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export const ENGINE_WRITES_ENV = 'KITMAQ_ESCRITURAS_MOTOR'
export const ENGINE_WRITES_ALLOW = 'permitir'

const PRECIO =
  'El precio lo define el motor de precios del sistema interno de KitMaq (conector kitmaq-internal). ' +
  'Proponelo ahí: cambiar_precio_fijo o cambiar_parametros_precios con confirmar=false muestran la vista previa, ' +
  'y el cambio queda en la propuesta pendiente (aprobar_propuesta_precios o /precios/propuesta). El runner lo lleva a Tienda Nube (L1).'
const STOCK =
  'El stock sale de POSBerry (depósitos de KitMaq) y el runner lo lleva a Tienda Nube. Corregilo en POSBerry, no en la tienda.'
const PRODUCTO =
  'Los productos de la tienda los coordina el sistema interno de KitMaq: las altas se aprueban en /precios/posberry ' +
  '(«Altas en Tienda Nube») y el runner las crea. Crear o borrar a mano deja la tienda distinta del motor; pedilo ahí.'
const FICHA =
  'El nombre, la descripción, la marca, las categorías y las fotos salen de la ficha aprobada en el sistema interno de KitMaq ' +
  '(/precios/fichas). Cambiala y aprobala ahí; el runner la escribe en Tienda Nube.'
const VARIANTES = `${PRECIO} ${STOCK} Las variantes (SKU, precio, stock) también las escribe el runner.`

/** Tools that write fields owned by the engine, with the reason given when they refuse. */
export const ENGINE_OWNED_TOOLS: Readonly<Record<string, string>> = {
  update_product_stock_price: `${PRECIO} ${STOCK}`,
  update_variant_stock: STOCK,
  update_product_variant: VARIANTES,
  batch_update_product_variants: VARIANTES,
  replace_all_product_variants: VARIANTES,
  create_product_variant: VARIANTES,
  delete_product_variant: VARIANTES,
  create_product: PRODUCTO,
  delete_product: PRODUCTO,
  update_product: FICHA,
  add_product_images: FICHA,
  update_product_image: FICHA,
  delete_product_image: FICHA,
}

export function engineWritesAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[ENGINE_WRITES_ENV] === ENGINE_WRITES_ALLOW
}

/** Refusal returned instead of calling the API. */
export function engineWriteRefusal(name: string) {
  return {
    isError: true,
    content: [{
      type: 'text' as const,
      text:
        `'${name}' no escribe en Tienda Nube desde esta sesión. ${ENGINE_OWNED_TOOLS[name]} ` +
        `(Para habilitarla a propósito: ${ENGINE_WRITES_ENV}=${ENGINE_WRITES_ALLOW} en el entorno del server.)`,
    }],
  }
}

/**
 * Proxies the server so every registerTool/tool call of an engine-owned name gets a
 * handler (its last argument) that refuses while the switch is off.
 */
export function guardServer(server: McpServer): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (prop !== 'tool' && prop !== 'registerTool') {
        return typeof value === 'function' ? value.bind(target) : value
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK boundary
      return (...args: any[]) => {
        const name = args[0]
        const handler = args[args.length - 1]
        if (typeof name === 'string' && name in ENGINE_OWNED_TOOLS && typeof handler === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- passthrough to the SDK
          args[args.length - 1] = (...callArgs: any[]) =>
            engineWritesAllowed() ? handler(...callArgs) : engineWriteRefusal(name)
        }
        return value.apply(target, args)
      }
    },
  }) as McpServer
}
