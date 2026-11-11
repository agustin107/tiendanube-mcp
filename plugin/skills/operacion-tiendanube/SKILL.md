---
name: operacion-tiendanube
description: Referencia para operar la tienda KitMaq en TiendaNube a traves del server MCP "tiendanube". Usar cuando se pida ver productos, stock o precios; gestionar pedidos, envios y tracking; ver clientes; manejar categorias, paginas o blog; crear cupones; revisar metricas de ventas o webhooks; o cuando se pida cambiar precio, stock, productos o fichas en TiendaNube (eso se hace en el sistema interno de KitMaq, no aca). Indica que tool invocar para cada tarea, a donde mandar los cambios del motor y las reglas de marca KitMaq que aplican a todo el contenido de cara al cliente.
---

# Operar TiendaNube (KitMaq)

El server MCP `tiendanube` (v1.5.0) expone **84 tools** contra la API de TiendaNube de la tienda KitMaq (store_id `7734059`). Corre en modo stdio via `run-mcp.sh` y el token da acceso total a la tienda. Esta skill dice que tool usar para cada tarea, que cambios van al sistema interno y que reglas respetar.

## ⛔ Precio, stock, productos y fichas: en el sistema interno, no acá

El **sistema interno de KitMaq** (conector `kitmaq-internal`) es la fuente de verdad de costos, precios (L1 mostrador/web, que es el de la tienda; L2 revendedor; L3 MercadoLibre), stock por depósito, fichas y SKUs. Un **runner** programado es el único que escribe en TiendaNube: precios, stock, altas de productos y contenido, con vista previa, OK de una persona y tope por corrida. Si se cambia algo de eso desde acá, la tienda queda distinta del motor.

Por eso, salvo que `KITMAQ_ESCRITURAS_MOTOR=permitir`, estas tools **se niegan** y devuelven a dónde ir: `update_product_stock_price`, `update_variant_stock`, `update_product_variant`, `batch_update_product_variants`, `replace_all_product_variants`, `create_product_variant`, `delete_product_variant`, `create_product`, `update_product`, `delete_product`, `add_product_images`, `update_product_image`, `delete_product_image`. No insistas ni busques otra tool que haga lo mismo.

| Pedido | Dónde se hace |
|---|---|
| Precio de uno o varios productos | Proponerlo en el sistema interno (ver «Cambios de precio» abajo) |
| Stock | En POSBerry; el runner lo lleva a la tienda |
| Producto nuevo en la tienda | «Altas en Tienda Nube» (`/precios/posberry`): se crean ocultos, con OK si son más de 40 |
| Nombre, descripción, marca, categorías, fotos | La ficha en el sistema interno (`/precios/fichas`); se aprueba ahí |
| Si va o no a la web | «Va a la web» en la ficha del sistema interno |

### Cambios de precio (ej. «subí 5 % las soldadoras»)

1. Leer en el sistema interno: `ver_precios` (con `buscar`) para ver los SKUs, su costo, el origen de cada lista y el vigente.
2. El motor no tiene una regla por categoría. Para un grupo de productos, proponé un **precio fijo por SKU** con `cambiar_precio_fijo` (L1) **con `confirmar=false`**: devuelve la vista previa de qué precios cambiarían, sin guardar nada. Mostrásela a la persona. Ojo: el precio fijo queda puesto a mano y no sigue al costo; decilo. Además `cambiar_precio_fijo` reemplaza **todo** el precio fijo del SKU: lo que no mandes deja de estar fijo. Antes, mirá con `ver_precios` qué valores fijos tiene y reenviá los que tienen que quedar. Si lo que cambia es el criterio general (markup o comisiones de L1), es `cambiar_parametros_precios` con vista previa, y eso mueve todos los productos.
3. Con el OK de la persona, `confirmar=true`: el cambio queda en la **propuesta pendiente**, no en la tienda.
4. La propuesta se aprueba con `aprobar_propuesta_precios` (vista previa → `confirmar=true` con el `propuestaId` que se vio) o en `/precios/propuesta`. Recién ahí el runner la lleva a TiendaNube (L1) y a MercadoLibre (L3).

Las herramientas de escritura del sistema interno piden el conector de una persona de KitMaq con escritura. Si no están disponibles, explicá el cambio y mandá a la pantalla de `/precios`.

## Tools por dominio

### Productos

- `list_products` — listar/buscar productos (filtros: `q`, `category_id`, `published`, `min_stock`/`max_stock`, `free_shipping`, fechas, `sort_by` incluido `best-selling`). Paginado `per_page` (máx 200, default 30).
- `get_product` — detalle completo por ID.
- `get_product_by_sku` — buscar un producto directamente por SKU.
- `create_product`, `update_product`, `delete_product` — **del motor: se niegan** (ver arriba).

### Imágenes de producto

- `list_product_images` — listar imágenes (id, src, posición, alt).
- `add_product_images`, `update_product_image`, `delete_product_image` — **del motor: se niegan** (las fotos son parte de la ficha).

### Variantes, stock y precio

- `list_product_variants` / `get_product_variant` — listar / ver una variante.
- `create_product_variant`, `update_product_variant`, `delete_product_variant`, `update_product_stock_price`, `batch_update_product_variants`, `replace_all_product_variants`, `update_variant_stock` — **del motor: se niegan** (ver arriba).
- `set_variant_extra_shipping_days` — días extra de despacho de una variante. Escritura, abierta.
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

### Páginas, blog y metafields

- `list_pages` / `get_page` / `create_page` / `update_page` / `delete_page` — páginas institucionales. Escritura en las de alta/edición/baja.
- Blog: `get_blog`, `list_blog_posts`, `get_blog_post`, `create_blog_post`, `update_blog_post`, `publish_blog_post`, `unpublish_blog_post`, `delete_blog_post`, `upload_blog_media`, `upload_blog_thumbnail`.
- Metafields: `list_metafields`, `create_metafield` / `update_metafield` / `delete_metafield`, y `set_related_products` (productos relacionados que muestra el theme).

### Tienda y webhooks

- `get_store_info` — datos generales (nombre, dominio, moneda, idioma).
- `list_webhooks` / `get_webhook` — webhooks registrados (debugging de notificaciones `product/*`, `order/*`).
- `create_webhook` / `update_webhook` / `delete_webhook` — gestión de webhooks. Escritura.

## Patrones comunes

- **Cambiar un producto puntual**: `get_product_by_sku` -> `get_product` para mostrar lo actual; el cambio (precio, stock, ficha) va al sistema interno como dice arriba.
- **Revisar ventas del período**: `get_sales_by_period` / `get_revenue_summary` / `get_orders_dashboard`; para detalle puntual `list_orders` -> `get_order`.
- **Priorizar catálogo**: `get_best_selling_products` para ver qué empujar primero.
- **Mover una orden en el flujo**: `get_order` -> `update_order_status`; para despacho, `list_fulfillment_orders` -> `update_fulfillment_order` / `add_tracking_event`.
- **Promo nueva**: `list_coupons` (no pisar uno existente) -> `create_coupon`.
- **Control de stock**: `get_inventory_alerts` para detectar faltantes.

## Reglas de operación

- **Escrituras siempre confirmadas**: las que siguen abiertas (pedidos, envíos, clientes, cupones, categorías, páginas, blog, metafields, webhooks) modifican la tienda en vivo. Mostrar el cambio propuesto y esperar el OK antes de ejecutar. Extra cuidado con las destructivas (`delete_*`, `cancel_order`).
- **No esquivar el candado**: si una tool del motor se niega, el cambio va al sistema interno. No pedir que se prenda `KITMAQ_ESCRITURAS_MOTOR` para resolver un pedido común.
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

## Precios de la tienda

El precio de la tienda es la **lista L1** del motor de precios del sistema interno. Esta skill no trae fórmulas: para saber cuánto sale un producto o por qué, `ver_precios` / `historial_precio` en el sistema interno (los parámetros, `ver_parametros_precios`, solo los ve KitMaq). No calcules precios a mano desde el costo ni con planillas viejas.
