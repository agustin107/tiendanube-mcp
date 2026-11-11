# tiendanube-mcp

Plugin de Cowork para operar la tienda KitMaq en TiendaNube. Conecta el server MCP de TiendaNube y le suma a Claude el conocimiento de qué herramienta usar para cada tarea, qué cambios van al sistema interno de KitMaq y las reglas de marca KitMaq.

## Qué incluye

- **MCP TiendaNube** (`.mcp.json`): server stdio que corre `run-mcp.sh` y expone 84 tools (productos, variantes, órdenes, envíos, clientes, categorías, cupones, páginas, blog, metafields, métricas, webhooks).
- **Skill `operacion-tiendanube`**: referencia de qué tool invocar para cada tarea, patrones de combinación, reglas de operación (escrituras confirmadas, paginar lecturas) y reglas de marca (capitalización KitMaq, no mencionar Litoralmaq, dominio, garantía) y a dónde mandar los cambios de precio, stock y fichas.

## Requisitos

Antes de usar el plugin, el MCP tiene que estar buildeado y con credenciales en tu máquina:

```bash
cd /Users/anrr/code/github/tiendanube-mcp
git pull && npm install && npm run build
```

El plugin asume esta ruta del lanzador:

```
/Users/anrr/code/github/tiendanube-mcp/run-mcp.sh
```

Si moviste el repo, actualizá `command` en `.mcp.json`.

### Credenciales

`run-mcp.sh` carga `TN_ACCESS_TOKEN` y `TN_STORE_ID` por su cuenta (vía su propio `.env` / entorno), por eso `env` en `.mcp.json` va vacío. El token de TiendaNube da acceso total a la tienda — tratalo como contraseña. Si se filtra, desinstalá la app en el admin de TiendaNube para revocarlo.

Store de KitMaq: `7734059`.

## Uso

Después de instalar el plugin, podés pedir cosas como:

- "Listame los primeros 10 productos de KitMaq."
- "Cuántas órdenes pagadas hay en lo que va del mes."
- "Mostrame el detalle del producto con SKU XXX."
- "Subí 5% las soldadoras." (Claude lo propone en el sistema interno con vista previa; el runner lo lleva a la tienda.)
- "Creá un cupón del 9% para transferencia."

Claude aplica solo el skill `operacion-tiendanube` cuando detecta tareas de tienda.

## Notas

- El MCP corre solo en modo stdio (no abre puertos).
- Las tools de escritura que siguen abiertas (pedidos, envíos, cupones, contenido) siempre piden confirmación antes de ejecutarse.
- Precio, stock, variantes, alta/baja de productos, ficha y fotos los escribe el runner del sistema interno de KitMaq; esas tools se niegan salvo `KITMAQ_ESCRITURAS_MOTOR=permitir` en el `.env.local` del server.
