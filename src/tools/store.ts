import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { tnFetch, pickLocalized } from '../client.js'
import type { TNStore } from '../types.js'

export function registerGetStoreInfo(server: McpServer) {
  server.registerTool(
    'get_store_info',
    {
      description: 'Obtiene la información general de la tienda: nombre, país, moneda, idioma principal, plan, dominios, email de contacto y features de API habilitadas.',
    },
    async () => {
      const store = await tnFetch<TNStore>('/store')

      const info = {
        id: store.id,
        nombre: pickLocalized(store.name),
        pais: store.country,
        idioma_principal: store.main_language,
        moneda: store.main_currency,
        plan: store.plan_name,
        email_dueno: store.email,
        email_contacto: store.contact_email,
        telefono: store.phone,
        logo: store.logo,
        dominios: store.domains,
        dominio_original: store.original_domain,
        idiomas_activos: Object.entries(store.languages ?? {})
          .filter(([, l]) => l.active)
          .map(([lang, l]) => ({ idioma: lang, moneda: l.currency })),
        cuentas_cliente: store.customer_accounts,
        creada: store.created_at,
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Tienda ${store.id}:\n\n${JSON.stringify(info, null, 2)}`,
        }],
      }
    }
  )
}
