# @traid/tiendanube-mcp

MCP server completo para [Tienda Nube / Nuvemshop](https://www.tiendanube.com). 13 tools de operaciones de seller —incluyendo write-back— para usar desde Claude Code, Cursor, o cualquier cliente MCP.

Primer MCP completo de Tienda Nube en el ecosistema. Los dos proyectos community que existían en Python (`AlexandreProenca/nuvemshop-mcp-server`, `ropu/MCP-tienda_nube`) no tienen licencia y no son legalmente reutilizables en un producto comercial.

## Tools disponibles

| Tool | Descripción | Tipo |
|------|-------------|------|
| `list_products` | Lista productos con filtros (stock, precio, categoría, fecha) | Lectura |
| `get_product` | Detalle de un producto (por id o por SKU) | Lectura |
| `update_product` | Actualiza atributos de producto (nombre, descripción, tags). Variantes: ver tools de variants/ | Escritura |
| `list_orders` | Lista órdenes con filtros (status, payment, shipping, fecha) | Lectura |
| `get_order` | Detalle completo de una orden | Lectura |
| `update_order_status` | Cerrar, reabrir o cancelar una orden | Escritura |
| `list_customers` | Lista clientes con búsqueda y filtros de fecha | Lectura |
| `get_customer` | Detalle de un cliente con direcciones | Lectura |
| `list_categories` | Lista categorías, filtra por parent o handle | Lectura |
| `get_store_info` | Info de la tienda (plan, moneda, dominios) | Lectura |
| `list_coupons` | Lista cupones de descuento | Lectura |
| `create_coupon` | Crea nuevo cupón (percentage, absolute, shipping) | Escritura |
| `list_webhooks` | Lista webhooks registrados por tu app | Lectura |

## Setup

### 1. Obtener el access token

Tienda Nube usa OAuth 2.0 con el flujo "authorization code". Los tokens **no expiran** hasta que se genera uno nuevo o el usuario desinstala la app.

Opción más simple para uso propio (tu propia tienda):

1. Creá una app en [partners.tiendanube.com](https://partners.tiendanube.com) (portal de partners).
2. Agregá `https://httpbin.org/anything` como redirect URI.
3. Abrí en el browser: `https://www.tiendanube.com/apps/{app_id}/authorize` con tu `app_id`.
4. Autorizá con tu cuenta dueña de la tienda → el redirect te devuelve un `code` en la URL.
5. Intercambiá el `code` por el `access_token` (dura 5 minutos antes de expirar):

```bash
curl -X POST https://www.tiendanube.com/apps/authorize/token \
  -H 'Content-Type: application/json' \
  -d '{
    "client_id": "TU_CLIENT_ID",
    "client_secret": "TU_CLIENT_SECRET",
    "grant_type": "authorization_code",
    "code": "EL_CODE_DEL_REDIRECT"
  }'
```

La respuesta trae `access_token`, `token_type: "bearer"`, `scope` y `user_id` (ese es tu `TN_STORE_ID`). Guardá las dos cosas.

### 2. Configurar credenciales

Copiá `.env.example` a `.env.local` y completá los valores:

```bash
cp .env.example .env.local
```

```env
TN_STORE_ID=1234567
TN_ACCESS_TOKEN=tu_token
TN_APP_NAME=Tiendanube MCP
TN_CONTACT_EMAIL=me@example.com
```

### 3. Configurar el MCP

El repo incluye configs de proyecto que leen `.env.local` — **no hace falta pegar secretos en el JSON**.

**Cursor** — ya incluido en `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "tiendanube": {
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"],
      "envFile": "${workspaceFolder}/.env.local"
    }
  }
}
```

**Claude Code** — ya incluido en `.mcp.json`:

```json
{
  "envFile": ".env.local",
  "mcpServers": {
    "tiendanube": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PROJECT_DIR}/dist/index.js"]
    }
  }
}
```

El servidor también carga `.env.local` al arrancar, así que funciona aunque el cliente MCP no soporte `envFile`.

Compilá antes de conectar: `pnpm run build`

`TN_APP_NAME` y `TN_CONTACT_EMAIL` se usan para el header `User-Agent` que la API de TN recomienda enviar.

## Uso

Una vez configurado, Claude Code puede ejecutar directamente:

- "Listame los productos con menos de 5 unidades de stock"
- "Mostrame las últimas 20 órdenes pagadas"
- "Actualizá el precio de la variante X a $15000"
- "Creá un cupón `VERANO30` del 30% con mínimo $20000, válido hasta 2026-12-31"
- "Cancelá la orden 12345 con motivo inventory y devolvé stock"
- "Cuáles son los webhooks de mi app en la tienda?"

## Características

- **Auth correcto** — usa el header `Authentication: bearer` (no `Authorization`), como exige TN
- **User-Agent configurable** — con email de contacto, como recomienda la API
- **Multilenguaje** — TN devuelve nombres y descripciones en varios idiomas; el MCP los colapsa al idioma preferido
- **Rate limit handling** — retry automático con backoff ante 429, respetando `X-Rate-Limit-Reset`
- **Validación Zod** — cada parámetro validado antes de llamar a la API
- **Errores legibles** — formatea los errores de validación de TN (`{ field: [...] }`) en mensajes humanos

## Sites soportados

Funciona con Tienda Nube Argentina (`tiendanube.com`) y Nuvemshop Brasil (`nuvemshop.com.br`). Como la API de TN requiere apuntar al mismo dominio del que viene el `store_id`, el MCP usa siempre `api.tiendanube.com/v1/{store_id}` que espeja también Nuvemshop Brasil.

## Desarrollo

```bash
cd mcp/tiendanube-mcp
npm install
npm run build    # compila a dist/
npm run dev      # corre con tsx (stdio)
```

## Equivalente curl

Para debug podés probar los mismos endpoints con curl:

```bash
# list_products
curl "https://api.tiendanube.com/v1/$TN_STORE_ID/products?per_page=30" \
  -H "Authentication: bearer $TN_ACCESS_TOKEN" \
  -H "User-Agent: mi-app (me@example.com)"

# update_price de una variante (patch bulk)
curl -X PATCH "https://api.tiendanube.com/v1/$TN_STORE_ID/products/stock-price" \
  -H "Authentication: bearer $TN_ACCESS_TOKEN" \
  -H "User-Agent: mi-app (me@example.com)" \
  -H "Content-Type: application/json" \
  -d '[{"variant_id": 123, "price": 15000}]'
```

## Upgrade path

Si necesitás solo lectura (analítica, dashboards, LLMs sin riesgo), usá el subset publicado como [`@traid/tiendanube-mcp-read`](../tiendanube-mcp-read/).

## Licencia

MIT — por [TRAID](https://traid.ai)
