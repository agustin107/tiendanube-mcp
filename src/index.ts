#!/usr/bin/env node

// MCP Server Tienda Nube / Nuvemshop — 25 tools completas con write-back.
// Primer MCP full de Tienda Nube en el ecosistema (2 community abandonadas en Python sin licencia).
// Extensión local (Kitmaq): +12 tools de creación/borrado sobre el fork de TRAID v1.0.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import {
  registerListProducts,
  registerGetProduct,
  registerUpdateProduct,
  registerCreateProduct,
  registerDeleteProduct,
  registerUpdateProductStockPrice,
} from './tools/products.js'
import {
  registerCreateProductVariant,
  registerUpdateProductVariant,
  registerDeleteProductVariant,
} from './tools/variants.js'
import { registerListOrders, registerGetOrder, registerUpdateOrderStatus } from './tools/orders.js'
import {
  registerListCustomers,
  registerGetCustomer,
  registerCreateCustomer,
  registerUpdateCustomer,
  registerDeleteCustomer,
} from './tools/customers.js'
import {
  registerListCategories,
  registerCreateCategory,
  registerUpdateCategory,
  registerDeleteCategory,
} from './tools/categories.js'
import { registerGetStoreInfo } from './tools/store.js'
import { registerListCoupons, registerCreateCoupon } from './tools/coupons.js'
import { registerListWebhooks } from './tools/webhooks.js'

const server = new McpServer({
  name: 'tiendanube',
  version: '1.1.0-kitmaq',
})

// Productos (6)
registerListProducts(server)
registerGetProduct(server)
registerUpdateProduct(server)
registerCreateProduct(server)
registerDeleteProduct(server)
registerUpdateProductStockPrice(server)

// Variantes (3)
registerCreateProductVariant(server)
registerUpdateProductVariant(server)
registerDeleteProductVariant(server)

// Órdenes (3)
registerListOrders(server)
registerGetOrder(server)
registerUpdateOrderStatus(server)

// Clientes (5)
registerListCustomers(server)
registerGetCustomer(server)
registerCreateCustomer(server)
registerUpdateCustomer(server)
registerDeleteCustomer(server)

// Categorías (4)
registerListCategories(server)
registerCreateCategory(server)
registerUpdateCategory(server)
registerDeleteCategory(server)

// Misc (4)
registerGetStoreInfo(server)
registerListCoupons(server)
registerCreateCoupon(server)
registerListWebhooks(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[tn-mcp] Server iniciado — 25 tools disponibles (v1.1.0-kitmaq)')
}

main().catch((error) => {
  console.error('[tn-mcp] Error fatal:', error)
  process.exit(1)
})
