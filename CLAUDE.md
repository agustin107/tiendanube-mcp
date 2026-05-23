# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run build   # compile TypeScript → dist/
pnpm run dev     # run server directly via tsx (stdio, no compile step)
pnpm run start   # run compiled dist/index.js
```

No test runner or linter is configured.

## Required env vars

Set these before running (via `.env.local` or MCP client config):

| Var | Description |
|-----|-------------|
| `TN_STORE_ID` | Store ID — the `user_id` returned by the OAuth token exchange |
| `TN_ACCESS_TOKEN` | Bearer token (non-expiring until revoked) |
| `TN_APP_NAME` | App name for User-Agent header |
| `TN_CONTACT_EMAIL` | Contact email for User-Agent header |

## Architecture

**Entry point** (`src/index.ts`): creates `McpServer`, calls every `register*` function, connects via `StdioServerTransport`.

**Auth** (`src/auth.ts`): reads the four env vars above. No OAuth flow — token is obtained externally and injected as env. Throws descriptive errors if vars are missing.

**HTTP client** (`src/client.ts`):
- `tnFetch<T>(path, options)` — fetch and return data directly
- `tnFetchWithMeta<T>(path, options)` — fetch and return `{ data, totalCount, linkHeader }`
- Auto-retries on 429 respecting `X-Rate-Limit-Reset`; retries network errors up to `MAX_RETRIES=2`
- **Critical**: auth header is `Authentication: bearer <token>` — NOT `Authorization`
- `pickLocalized(value, lang?)` — collapses TN's multilingual objects `{ es, pt, en }` to a single string

**Types** (`src/types.ts`): TypeScript interfaces for TN API responses (`TNProduct`, `TNOrder`, etc.) and `TNConfig`.

**Tools** (`src/tools/*.ts`): one file per resource domain. Each file exports one or more `register*(server: McpServer)` functions. Pattern:

```ts
export function registerSomeTool(server: McpServer) {
  server.tool('tool_name', 'description', { /* zod schema */ }, async (args) => {
    const data = await tnFetch<SomeType>('/endpoint', { method: 'POST', body: args })
    return { content: [{ type: 'text', text: '...' }] }
  })
}
```

## Adding a new tool

1. Add a `register*` function in the appropriate `src/tools/*.ts` file (or create a new file).
2. Import and call it in `src/index.ts`.
3. Use Zod for all parameter validation — every param must have a `.describe()`.
4. Use `tnFetch` for write operations, `tnFetchWithMeta` when you need pagination headers.
5. Multilingual fields (name, description, handle) are `Record<string, string>` — pass them through as-is; use `pickLocalized()` only when displaying to the user.

## TN API quirks

- Auth header: `Authentication: bearer <token>` (not `Authorization`)
- Multilingual fields come back as `{ es: "...", pt: "...", en: "..." }` — use `pickLocalized()` to display
- `stock: null` means unlimited stock
- Variants hold price/stock, not the product itself
- Bulk stock/price update: `PATCH /products/stock-price` (max 50 items)
- Base URL: `https://api.tiendanube.com/v1/{store_id}/`
