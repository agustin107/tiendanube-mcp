#!/usr/bin/env node

// MCP Server Tienda Nube / Nuvemshop — 64 tools.
// v1.3.0: analytics, fulfillment orders, transactions, complete coupon/webhook CRUD.

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
import { registerListCoupons, registerGetCoupon, registerCreateCoupon, registerUpdateCoupon, registerDeleteCoupon } from './tools/coupons.js'
import { registerListWebhooks, registerGetWebhook, registerCreateWebhook, registerUpdateWebhook, registerDeleteWebhook } from './tools/webhooks.js'
import {
  registerAddProductImages,
  registerListProductImages,
  registerDeleteProductImage,
  registerUpdateProductImage,
} from './tools/images.js'
import {
  registerGetRevenueSummary,
  registerGetSalesByPeriod,
  registerGetBestSellingProducts,
  registerGetOrdersDashboard,
  registerGetInventoryAlerts,
  registerGetPendingPayments,
} from './tools/analytics.js'
import {
  registerListFulfillmentOrders,
  registerGetFulfillmentOrder,
  registerUpdateFulfillmentOrder,
  registerAddTrackingEvent,
  registerListTrackingEvents,
} from './tools/fulfillment.js'
import { registerListOrderTransactions, registerGetOrderTransaction } from './tools/transactions.js'

const server = new McpServer({
  name: 'tiendanube',
  version: '1.3.0',
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

// Misc — Tienda, Cupones (5), Webhooks (5)
registerGetStoreInfo(server)
registerListCoupons(server)
registerGetCoupon(server)
registerCreateCoupon(server)
registerUpdateCoupon(server)
registerDeleteCoupon(server)
registerListWebhooks(server)
registerGetWebhook(server)
registerCreateWebhook(server)
registerUpdateWebhook(server)
registerDeleteWebhook(server)

// Imágenes de producto (4)
registerAddProductImages(server)
registerListProductImages(server)
registerDeleteProductImage(server)
registerUpdateProductImage(server)

// Analytics (6)
registerGetRevenueSummary(server)
registerGetSalesByPeriod(server)
registerGetBestSellingProducts(server)
registerGetOrdersDashboard(server)
registerGetInventoryAlerts(server)
registerGetPendingPayments(server)

// Fulfillment Orders (5)
registerListFulfillmentOrders(server)
registerGetFulfillmentOrder(server)
registerUpdateFulfillmentOrder(server)
registerAddTrackingEvent(server)
registerListTrackingEvents(server)

// Transacciones (2)
registerListOrderTransactions(server)
registerGetOrderTransaction(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[tn-mcp] Server iniciado — 64 tools disponibles (v1.3.0)')
}

main().catch((error) => {
  console.error('[tn-mcp] Error fatal:', error)
  process.exit(1)
})
