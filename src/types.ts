// Tipos compartidos del MCP server Tienda Nube / Nuvemshop

export interface TNConfig {
  storeId: string
  accessToken: string
  appName: string
  contactEmail: string
}

// TN devuelve objetos multilenguaje: { es: "Nombre", pt: "Nome", en: "Name" }
export type TNLocalized = Record<string, string>

export interface TNProduct {
  id: number
  name: TNLocalized
  description: TNLocalized
  handle: TNLocalized
  attributes: TNLocalized[]
  published: boolean
  free_shipping: boolean
  requires_shipping: boolean
  canonical_url: string | null
  video_url: string | null
  seo_title: TNLocalized | null
  seo_description: TNLocalized | null
  brand: string | null
  created_at: string
  updated_at: string
  variants: TNVariant[]
  tags: string
  categories: Array<{ id: number; name: TNLocalized }>
  images: Array<{ id: number; src: string; position: number }>
}

export interface TNVariant {
  id: number
  product_id: number
  price: string | null
  promotional_price: string | null
  stock_management: boolean
  stock: number | null
  weight: string | null
  sku: string | null
  values: TNLocalized[]
  created_at: string
  updated_at: string
}

export interface TNOrder {
  id: number
  token: string
  store_id: number
  number: number
  status: 'open' | 'closed' | 'cancelled'
  payment_status: string
  shipping_status: string
  contact_email: string | null
  contact_phone: string | null
  contact_identification: string | null
  subtotal: string
  discount: string
  total: string
  total_usd: string | null
  currency: string
  created_at: string
  updated_at: string
  completed_at: string | null
  customer: TNCustomer | null
  products: Array<{
    id: number
    product_id: number
    variant_id: number
    name: string
    price: string
    quantity: number
    sku: string | null
  }>
  shipping_option: string | null
  shipping_tracking_number: string | null
}

export interface TNCustomer {
  id: number
  name: string
  email: string | null
  phone: string | null
  identification: string | null
  note: string | null
  total_spent: string
  total_spent_currency: string
  last_order_id: number | null
  active: boolean
  accepts_marketing: boolean
  created_at: string
  updated_at: string
  default_address?: TNAddress | null
}

export interface TNAddress {
  address: string
  city: string
  country: string
  created_at?: string
  default?: boolean
  floor: string | null
  locality: string
  number: string
  phone: string
  province: string
  zipcode: string
}

export interface TNCategory {
  id: number
  name: TNLocalized
  description: TNLocalized
  handle: TNLocalized
  parent: number | null
  subcategories: number[]
  google_shopping_category: string | null
  visibility: 'visible' | 'hidden' | 'soft-hidden'
  created_at: string
  updated_at: string
}

export interface TNStore {
  id: number
  name: TNLocalized
  country: string
  main_language: string
  main_currency: string
  email: string
  contact_email: string
  logo: string | null
  phone: string | null
  plan_name: string
  languages: Record<string, { active: boolean; currency: string }>
  domains: string[]
  original_domain: string
  created_at: string
  customer_accounts: 'optional' | 'mandatory'
}

export interface TNCoupon {
  id: number
  code: string
  type: 'percentage' | 'absolute' | 'shipping'
  value: string | null
  valid: boolean
  used: number
  max_uses: number | null
  start_date: string | null
  end_date: string | null
  min_price: string | null
  includes_shipping: boolean
  first_consumer_purchase: boolean
  combines_with_other_discounts: boolean
  only_cheapest_shipping: boolean
  categories: number[] | null
  products: number[] | null
  created_at: string
  updated_at: string
}

export interface TNWebhook {
  id: number
  url: string
  event: string
  created_at: string
  updated_at: string
}

export interface TNImage {
  id: number
  src: string
  position: number
  product_id: number
  created_at: string
  updated_at: string
  alt: TNLocalized | null
}

export interface TNError {
  code?: number
  message?: string | Record<string, string[]>
  description?: string
}

export interface TNPaging {
  total?: number
  page?: number
  per_page?: number
}
