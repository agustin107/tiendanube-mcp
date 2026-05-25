# SPEC: Tiendanube MCP — Analytics & Operations Expansion

## Objective

Expand the Tiendanube MCP server with tools that support daily store management from Claude Code. Priority is analytics (computed from existing APIs), followed by fulfillment/shipping operations, payment visibility, and completing existing resource sets.

**Target user**: Store owner managing a single-location Tiendanube store from Claude Code.

---

## Scope

### Phase 1 — Analytics Tools (computed, no new API surface needed)

These tools aggregate existing order/product data into actionable insights.

| Tool | Description |
|------|-------------|
| `get_revenue_summary` | Total revenue for last N days (default 30). Returns: total, avg order value, order count. Accepts `days` param. |
| `get_sales_by_period` | Revenue and order count grouped by day. Accepts `from` and `to` date params. |
| `get_best_selling_products` | Top N products ranked by units sold. Aggregated from order line items. Accepts `limit` (default 10), `days` (default 30). |
| `get_orders_dashboard` | Count of orders by payment and fulfillment status. Snapshot of current state. |
| `get_inventory_alerts` | All variants where stock ≤ threshold (default 5). Returns: SKU, product name, current stock. |
| `get_pending_payments` | Orders with `payment_status: pending` older than N hours (default 24). |

**Implementation note**: All analytics tools use `tnFetchWithMeta` in a pagination loop. No new API endpoints needed — they compose on top of `list_orders` and `list_products` internals.

**Pagination helper** (shared, in `src/tools/analytics.ts`):

```ts
async function fetchAllPages<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const results: T[] = []
  let page = 1
  while (true) {
    const { data, linkHeader } = await tnFetchWithMeta<T[]>(path, {
      params: { ...params, page: String(page), per_page: '50' }
    })
    results.push(...data)
    if (!linkHeader?.includes('rel="next"')) break
    page++
  }
  return results
}
```

### Phase 2 — Fulfillment Orders (new API surface)

Daily shipping workflow: mark dispatched, add tracking numbers, log delivery events.

| Tool | Endpoint | Description |
|------|----------|-------------|
| `list_fulfillment_orders` | `GET /orders/{id}/fulfillment-orders` | List all fulfillment orders for an order |
| `get_fulfillment_order` | `GET /orders/{id}/fulfillment-orders/{fid}` | Get single fulfillment order |
| `update_fulfillment_order` | `PATCH /orders/{id}/fulfillment-orders/{fid}` | Update status, tracking number, carrier |
| `add_tracking_event` | `POST /orders/{id}/fulfillment-orders/{fid}/tracking-events` | Add tracking event (dispatched/in_transit/delivered) |
| `list_tracking_events` | `GET /orders/{id}/fulfillment-orders/{fid}/tracking-events` | List all tracking events for a fulfillment order |

### Phase 3 — Transactions (payment visibility)

View payment details per order.

| Tool | Endpoint | Description |
|------|----------|-------------|
| `list_order_transactions` | `GET /orders/{id}/transactions` | List all transactions (method, status, amounts, refunds) |
| `get_order_transaction` | `GET /orders/{id}/transactions/{tid}` | Full transaction detail |

### Phase 4 — Quick Wins (complete existing resource sets)

| Tool | Endpoint | Gap |
|------|----------|-----|
| `update_coupon` | `PUT /coupons/{id}` | Missing from coupon tools |
| `delete_coupon` | `DELETE /coupons/{id}` | Missing from coupon tools |
| `get_webhook` | `GET /webhooks/{id}` | Missing from webhook tools |
| `create_webhook` | `POST /webhooks` | Missing from webhook tools |
| `update_webhook` | `PUT /webhooks/{id}` | Missing from webhook tools |
| `delete_webhook` | `DELETE /webhooks/{id}` | Missing from webhook tools |

---

## Project Structure

New files:
- `src/tools/analytics.ts` — Phase 1 (6 tools)
- `src/tools/fulfillment.ts` — Phase 2 (5 tools)
- `src/tools/transactions.ts` — Phase 3 (2 tools)

Existing files to extend:
- `src/tools/coupons.ts` — add update + delete
- `src/tools/webhooks.ts` — add get, create, update, delete
- `src/index.ts` — import + call new register functions

---

## Code Style

- Follow existing pattern: `register*` function per file, called in `src/index.ts`
- All params validated with Zod + `.describe()`
- `tnFetch` for writes, `tnFetchWithMeta` for reads with pagination
- Multilingual fields: pass through as-is; use `pickLocalized()` only for display
- Return `{ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }`
- TypeScript strict, no `any`
- No comments unless non-obvious quirk
- All text in English

---

## Testing Strategy

No test runner configured. Manual verification after each phase:
- `pnpm run build` — must compile with no errors
- Smoke-test tools against live store via MCP client
- Analytics: cross-check numbers against Tiendanube admin dashboard

---

## Boundaries

**Always:**
- Validate all inputs with Zod
- Handle pagination automatically (don't expose page numbers for analytics)
- Return human-readable summaries alongside raw data

**Ask first:**
- Any tool that modifies order status
- Bulk operations affecting >10 records

**Never:**
- Delete orders or customers
- Expose raw API credentials in tool responses

---

## Acceptance Criteria

### Phase 1 — Analytics
- [ ] `get_revenue_summary` returns total, avg, count for last 30 days by default; accepts `days` param
- [ ] `get_sales_by_period` returns day-by-day breakdown for a date range
- [ ] `get_best_selling_products` returns top N products with units sold and revenue
- [ ] `get_orders_dashboard` returns order counts grouped by payment + fulfillment status
- [ ] `get_inventory_alerts` returns all variants with stock ≤ threshold
- [ ] `get_pending_payments` returns unpaid orders older than N hours
- [ ] All analytics tools handle pagination (>50 orders) transparently

### Phase 2 — Fulfillment
- [ ] `list_fulfillment_orders` returns all fulfillment orders for a given order ID
- [ ] `update_fulfillment_order` can set tracking number and status
- [ ] `add_tracking_event` creates a tracking event on a dispatched fulfillment order
- [ ] `list_tracking_events` lists all tracking events for a fulfillment order

### Phase 3 — Transactions
- [ ] `list_order_transactions` lists transactions with payment method, status, amounts
- [ ] `get_order_transaction` returns full detail including refund amounts

### Phase 4 — Quick Wins
- [ ] `update_coupon` and `delete_coupon` functional
- [ ] Full webhook CRUD (get, create, update, delete) functional
- [ ] `pnpm run build` passes after each phase

---

## Build Sequence

1. **Phase 4** first — quick wins, low risk, warms up the codebase
2. **Phase 1** — analytics (highest daily value, no new API risk)
3. **Phase 2** — fulfillment (new API surface, needs smoke testing)
4. **Phase 3** — transactions (smallest scope, good last)
