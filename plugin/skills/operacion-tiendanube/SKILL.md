---
name: operacion-tiendanube
description: Referencia para operar la tienda KitMaq en TiendaNube a traves del server MCP "tiendanube". Usar cuando se pida listar o editar productos, variantes, stock o precios; gestionar pedidos, envios y tracking; ver clientes; manejar categorias; crear cupones; revisar metricas de ventas o webhooks. Indica que tool invocar para cada tarea, como combinarlos, y las reglas de marca KitMaq que aplican a todo el contenido de cara al cliente.
---

# Operar TiendaNube (KitMaq)

El server MCP `tiendanube` (v1.3.0) expone **64 tools** contra la API de TiendaNube de la tienda KitMaq (store_id `7734059`). Corre en modo stdio via `run-mcp.sh` y el token da acceso total a la tienda. Esta skill dice que tool usar para cada tarea y que reglas respetar.

## Tools por dominio

### Productos

- `list_products` — listar/buscar productos (filtros: `q`, `category_id`, `published`, `min_stock`/`max_stock`, `free_shipping`, fechas, `sort_by` incluido `best-selling`). Paginado `per_page` (máx 200, default 30).
- `get_product` — detalle completo por ID.
- `get_product_by_sku` — buscar un producto directamente por SKU.
- `create_product` — crear producto nuevo. Escritura.
- `update_product` — editar atributos: nombre, descripción, tags, categorías, publicación, SEO. **No** toca precio/stock/SKU de variantes (la API rechaza variants en PUT). Escritura.
- `delete_product` — eliminar producto. Escritura destructiva.

### Imágenes de producto

- `list_product_images` — listar imágenes (id, src, posición, alt).
- `add_product_images` — agregar imágenes desde URL (`src`) o archivo local (`file_path` + `filename`). Máx 250 por producto, 10 MB c/u.
- `update_product_image` — cambiar posición o alt de una imagen. Escritura.
- `delete_product_image` — eliminar imagen. Escritura.

### Variantes, stock y precio

- `list_product_variants` / `get_product_variant` — listar / ver una variante.
- `create_product_variant` / `update_product_variant` / `delete_product_variant` — alta/edición/baja de variante. Escritura.
- `update_product_stock_price` — actualizar stock y/o precio de muchas variantes en una llamada (máx 50 productos). **Ideal para sincronizar precios desde el tracker/CSV.** Escritura.
- `batch_update_product_variants` — edición batch de variantes. Escritura.
- `replace_all_product_variants` — reemplazar todas las variantes de un producto. Escritura destructiva.
- `update_variant_stock` — ajustar solo stock de una variante. Escritura.
- `set_variant_extra_shipping_days` — días extra de despacho de una variante. Escritura.
- `get_inventory_alerts` — productos con stock bajo / alertas de inventario.

### Categorías

- `list_categories` — listar (filtrar raíz con `parent_id=0`). KitMaq usa 19 categorías raíz definidas.
- `get_category` — detalle de una categoría.
- `create_category` / `update_category` / `delete_category` — alta/edición/baja. Escritura. No crear categorías nuevas salvo pedido explícito.

### Pedidos

- `list_orders` — listar (filtros: `status`, `payment_status`, `shipping_status`, `channels`, fechas, `total_min`/`max`, `customer_ids`).
- `get_order` — detalle de una orden.
- `update_order` — editar datos de la orden. Escritura.
- `update_order_status` — cambiar estado (pagada, empaquetada, enviada, etc.). Escritura.
- `create_order` — crear orden. Escritura.
- `cancel_order` / `close_order` / `open_order` — cancelar / cerrar / reabrir. Escritura.
- `get_order_history_editions` / `get_order_history_values` — historial de ediciones de una orden.

### Pagos y transacciones

- `list_order_transactions` / `get_order_transaction` — transacciones de pago de una orden (método, estado, montos capturados/reembolsados).
- `get_pending_payments` — órdenes con pago pendiente.

### Envíos (fulfillment) y tracking

- `list_fulfillment_orders` / `get_fulfillment_order` — paquetes a despachar de una orden.
- `update_fulfillment_order` — actualizar un fulfillment order. Escritura.
- `list_tracking_events` / `add_tracking_event` — ver / agregar eventos de seguimiento de un envío. `add_*` es escritura.

### Clientes

- `list_customers` — listar/buscar (`q`, `email`, fechas).
- `get_customer` — detalle por ID.
- `create_customer` / `update_customer` / `delete_customer` — alta/edición/baja. Escritura.

### Cupones

- `list_coupons` — listar (filtros: `q` por código, `discount_type`, `valid`, fechas).
- `get_coupon` — detalle.
- `create_coupon` / `update_coupon` / `delete_coupon` — alta/edición/baja. Escritura.

### Métricas y reportes

- `get_orders_dashboard` — resumen tipo dashboard de órdenes.
- `get_revenue_summary` — resumen de facturación.
- `get_sales_by_period` — ventas por período.
- `get_best_selling_products` — top N más vendidos por unidades (órdenes pagadas de los últimos N días). Útil para priorizar catálogo.

### Tienda y webhooks

- `get_store_info` — datos generales (nombre, dominio, moneda, idioma).
- `list_webhooks` / `get_webhook` — webhooks registrados (debugging de notificaciones `product/*`, `order/*`).
- `create_webhook` / `update_webhook` / `delete_webhook` — gestión de webhooks. Escritura.

## Patrones comunes

- **Editar un producto puntual**: `list_products` o `get_product_by_sku` -> `get_product` (confirmar IDs/variantes) -> `update_product` (atributos) o `update_product_stock_price` (precio/stock). Confirmar antes de escribir.
- **Sincronizar precios desde el tracker/CSV**: armar el lote y usar `update_product_stock_price` (hasta 50 productos por llamada).
- **Revisar ventas del período**: `get_sales_by_period` / `get_revenue_summary` / `get_orders_dashboard`; para detalle puntual `list_orders` -> `get_order`.
- **Priorizar catálogo**: `get_best_selling_products` para ver qué empujar primero.
- **Mover una orden en el flujo**: `get_order` -> `update_order_status`; para despacho, `list_fulfillment_orders` -> `update_fulfillment_order` / `add_tracking_event`.
- **Promo nueva**: `list_coupons` (no pisar uno existente) -> `create_coupon`.
- **Control de stock**: `get_inventory_alerts` para detectar faltantes.

## Reglas de operación

- **Escrituras siempre confirmadas**: cualquier tool de crear/editar/eliminar modifica la tienda en vivo. Mostrar el cambio propuesto y esperar el OK antes de ejecutar. Extra cuidado con las destructivas (`delete_*`, `replace_all_product_variants`).
- **Paginar lecturas**: en `list_*` usar `per_page`/`page`; no volcar el catálogo entero si solo se busca un item.
- **No inventar datos**: si falta un precio o costo, decirlo. No completar con estimaciones.
- **Categorías fijas**: usar solo las 19 categorías raíz de KitMaq; no crear nuevas salvo pedido explícito.

## Reglas de marca KitMaq (aplican a TODO contenido de cara al cliente)

Valen para títulos y descripciones de productos, SEO, páginas institucionales, banners, cupones con texto visible y cualquier copy que vea el cliente final.

- **Capitalización**: la marca siempre se escribe **KitMaq** (K y M mayúsculas). Nunca "Kitmaq", "KITMAQ" ni "kitmaq".
- **Nunca mencionar "Litoralmaq"** en copy de cara al cliente. Es la tienda física relacionada y referencia interna; el cliente no la necesita conocer. KitMaq se posiciona como marca propia. La dirección física (Saenz 1587, Corrientes Capital) es el punto de retiro de KitMaq, sin nombrar Litoralmaq.
- **Web y handles**: dominio `kitmaq.com` (nunca `kitmaq.com.ar`). Mail `ventas@kitmaq.com` / `info@kitmaq.com`. Redes `kitmaqcom`.
- **Garantía**: 3 meses de fábrica por defecto. (Nota interna: la ley argentina exige mínimo 6 meses para bienes nuevos.)
- **Idioma**: español argentino, voseo, tono profesional pero informal.
- **Nombres de producto del proveedor** (mayúsculas con códigos): mantenerlos tal cual, no traducir.

## Modelo de pricing (para fijar/verificar precios)

Para llevar un costo neto GBS al precio de venta:

```
Costo c/Imp  = Costo GBS x 1.10          (impuestos 10%)
Subtotal     = Costo c/Imp x (1 + 0.12 + 0.05 + 0.05)   (financiamiento + envio + marketing)
Precio Final = Subtotal x 1.20           (margen 20%)
Precio Redon = MROUND(Precio Final, 100)
```

Multiplicador efectivo sobre el costo GBS: **x1.6104**. Los parámetros son configurables; si se ajusta alguno, recordar que afecta a todos los productos. Al discutir un precio puntual, mostrar costo GBS, precio final con la fórmula desglosada y precio redondeado.

> Los parámetros de pricing pueden estar desactualizados respecto del tracker maestro de KitMaq. Ante la duda, confirmar los porcentajes vigentes antes de aplicar.
