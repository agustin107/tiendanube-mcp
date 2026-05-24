#!/usr/bin/env node

// MCP Server Tienda Nube / Nuvemshop — 25 tools completas con write-back.
// Primer MCP full de Tienda Nube en el ecosistema (2 community abandonadas en Python sin licencia).
// Extensión local (Kitmaq): +12 tools de creación/borrado sobre el fork de TRAID v1.0.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import {
  registerListProducts,
  registerGetProduct,
  registerGetProductBySku,
  registerUpdateProduct,
  registerCreateProduct,
  registerDeleteProduct,
  registerUpdateProductStockPrice,
} from './tools/products.js'
import {
  registerListProductVariants,
  registerGetProductVariant,
  registerCreateProductVariant,
  registerUpdateProductVariant,
  registerReplaceAllProductVariants,
  registerBatchUpdateProductVariants,
  registerDeleteProductVariant,
  registerUpdateVariantStock,
  registerSetVariantExtraShippingDays,
} from './tools/variants.js'
import {
  registerListOrders,
  registerGetOrder,
  registerGetOrderHistoryValues,
  registerGetOrderHistoryEditions,
  registerCreateOrder,
  registerUpdateOrder,
  registerCloseOrder,
  registerOpenOrder,
  registerCancelOrder,
  registerUpdateOrderStatus,
} from './tools/orders.js'
import {
  registerListCustomers,
  registerGetCustomer,
  registerCreateCustomer,
  registerUpdateCustomer,
  registerDeleteCustomer,
} from './tools/customers.js'
import {
  registerListCategories,
  registerGetCategory,
  registerCreateCategory,
  registerUpdateCategory,
  registerDeleteCategory,
} from './tools/categories.js'
import { registerGetStoreInfo } from './tools/store.js'
import { registerListCoupons, registerGetCoupon, registerCreateCoupon } from './tools/coupons.js'
import { registerListWebhooks } from './tools/webhooks.js'
import {
  registerAddProductImages,
  registerListProductImages,
  registerDeleteProductImage,
  registerUpdateProductImage,
} from './tools/images.js'

const server = new McpServer({
  name: 'tiendanube',
  version: '1.2.0',
})

// Productos (7)
registerListProducts(server)
registerGetProduct(server)
registerGetProductBySku(server)
registerUpdateProduct(server)
registerCreateProduct(server)
registerDeleteProduct(server)
registerUpdateProductStockPrice(server)

// Variantes (9)
registerListProductVariants(server)
registerGetProductVariant(server)
registerCreateProductVariant(server)
registerUpdateProductVariant(server)
registerReplaceAllProductVariants(server)
registerBatchUpdateProductVariants(server)
registerDeleteProductVariant(server)
registerUpdateVariantStock(server)
registerSetVariantExtraShippingDays(server)

// Órdenes (10)
registerListOrders(server)
registerGetOrder(server)
registerGetOrderHistoryValues(server)
registerGetOrderHistoryEditions(server)
registerCreateOrder(server)
registerUpdateOrder(server)
registerCloseOrder(server)
registerOpenOrder(server)
registerCancelOrder(server)
registerUpdateOrderStatus(server)

// Clientes (5)
registerListCustomers(server)
registerGetCustomer(server)
registerCreateCustomer(server)
registerUpdateCustomer(server)
registerDeleteCustomer(server)

// Categorías (5)
registerListCategories(server)
registerGetCategory(server)
registerCreateCategory(server)
registerUpdateCategory(server)
registerDeleteCategory(server)

// Misc (5)
registerGetStoreInfo(server)
registerListCoupons(server)
registerGetCoupon(server)
registerCreateCoupon(server)
registerListWebhooks(server)

// Imágenes de producto (4)
registerAddProductImages(server)
registerListProductImages(server)
registerDeleteProductImage(server)
registerUpdateProductImage(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[tn-mcp] Server iniciado — 45 tools disponibles (v1.2.0)')
}

main().catch((error) => {
  console.error('[tn-mcp] Error fatal:', error)
  process.exit(1)
})
