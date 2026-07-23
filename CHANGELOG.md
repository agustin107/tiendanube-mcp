# Changelog

Todas las versiones de `@traid/tiendanube-mcp` en orden inverso.

## [1.5.0] — 2026-07-13

### Added
- Módulo **Metafields** (`src/tools/metafields.ts`) — 5 tools nuevas (total 84):
  - `list_metafields` — lista metafields por entidad (Product, Product_Variant, Category, Page, Order, Customer), filtrable por owner_id/namespace/key
  - `create_metafield` / `update_metafield` / `delete_metafield` — CRUD genérico
  - `set_related_products` — setea productos relacionados (alternativos) de un producto vía el metafield `related_products.related_products_ids` que lee el theme Base. Idempotente (crea o actualiza); `related_ids=[]` limpia.

## [1.0.0] — 2026-04-17

### Added
- Release inicial con 13 tools (9 lectura + 4 escritura)
- Auth con header `Authentication: bearer` (spec oficial TN)
- User-Agent configurable con email de contacto
- Rate limit handling con respeto a `X-Rate-Limit-Reset`
- Manejo de errores multi-formato (string, objeto de validación, description)
- Helper `pickLocalized` para colapsar objetos multilenguaje al idioma preferido
- Soporte Tienda Nube AR + Nuvemshop Brasil

### Tools (13)

**Lectura (9):**
- `list_products` — filtros stock/precio/categoría/fecha, paginación hasta 200
- `get_product` — detalle por id o por SKU
- `list_orders` — filtros status/payment/shipping/fecha/total
- `get_order` — detalle completo con productos y cliente
- `list_customers` — búsqueda de texto o email exacto
- `get_customer` — con default_address
- `list_categories` — filtro por parent_id y handle
- `get_store_info` — plan, dominios, idiomas activos
- `list_coupons` — filtro por validez y tipo
- `list_webhooks` — hooks registrados por la app

**Escritura (4):**
- `update_product` — actualiza atributos y variantes (precio, stock, SKU)
- `update_order_status` — close, open, cancel con refund/restock opcionales
- `create_coupon` — percentage / absolute / shipping con reglas de vigencia
- (más write-back previsto para v1.1)

### Notes
- Primer MCP completo de Tienda Nube en el ecosistema. Las 2 alternativas community en Python (`AlexandreProenca/nuvemshop-mcp-server`, `ropu/MCP-tienda_nube`) no tienen licencia y no son reutilizables en productos comerciales.
- Filosofía de auth "token inyectado" igual que `@traid/mercadolibre-mcp` modo A: no implementamos el OAuth interactivo; el token se obtiene una vez afuera (los tokens de TN no expiran).

## Pendientes para v1.1
- `update_product_stock` bulk via PATCH /products/stock-price
- `get_product_variants` con filtros avanzados
- `create_webhook` (POST /webhooks) para automatizar suscripciones
- `get_order_history` para auditoría de cambios
