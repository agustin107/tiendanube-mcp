# SPEC: Product Images Tools for tiendanube-mcp

## Objective

Add a new `src/tools/images.ts` module that exposes full CRUD for product images on Tienda Nube.  
The immediate trigger: a batch of products was created without images; images must be attached post-creation.

**TN API reference:** `POST/GET/PUT/DELETE /products/{product_id}/images`

---

## Tools to implement (4)

### 1. `add_product_images` (POST — batch)
Add one or more images to an existing product in a single call.

**Input:**
```ts
{
  product_id: number           // required
  images: Array<{
    src?: string               // URL to image (http/https)
    file_path?: string         // Absolute local path — tool reads + base64-encodes
    filename?: string          // Required when file_path is used; e.g. "photo.jpg"
    position?: number          // 1-based position in image list
    alt?: Record<string,string>// multilingual alt text { es, pt, en }
  }>
}
```

**Validation:** each item must have exactly one of `src` or `file_path`. Throw a descriptive error otherwise.  
**Behaviour:** iterate images sequentially, call `POST /products/{product_id}/images` for each. Return all results (success + any per-image errors) in one response.  
**File handling:** when `file_path` is provided, read the file with Node's `fs.promises.readFile`, base64-encode it, set `attachment` + `filename` in the API body.

---

### 2. `list_product_images` (GET)
List all images for a product.

**Input:**
```ts
{ product_id: number }
```

**Returns:** array of `{ id, src, position, alt, created_at, updated_at }`.

---

### 3. `delete_product_image` (DELETE)
Remove a single image from a product.

**Input:**
```ts
{ product_id: number; image_id: number }
```

**Returns:** confirmation message with deleted image ID.

---

### 4. `update_product_image` (PUT)
Update an image's position (and optionally alt text).

**Input:**
```ts
{
  product_id: number
  image_id: number
  position?: number
  alt?: Record<string,string>
}
```

**Returns:** updated image object.

---

## Project structure

```
src/tools/images.ts     ← new file (all 4 register functions)
src/index.ts            ← import + call all 4 register functions
```

No new files beyond these two edits.

---

## Code style (match existing tools)

- `server.registerTool(name, { description, inputSchema }, handler)`
- `inputSchema` uses raw Zod shapes (not `z.object(...)` at top level — just the shape object)
- Every param has `.describe()`
- Use `tnFetch<T>` for writes/deletes/updates, `tnFetchWithMeta` only if pagination is needed
- Return `{ content: [{ type: 'text', text: JSON.stringify(..., null, 2) }] }`
- No top-level comments; no multi-line docstrings
- TypeScript strict — no `any`

---

## Testing strategy

No test runner configured in this project.  
Manual verification:
1. `pnpm run build` — must compile with no errors
2. Run `pnpm run dev` against a real store and confirm each tool via MCP client (or `mcp-inspector`)

---

## Boundaries

| Always | Ask first | Never |
|--------|-----------|-------|
| Validate `src` XOR `file_path` per image | Before adding >10 images at once | Delete all images without explicit image_id |
| Report per-image errors without stopping the batch | If file extension is not gif/jpg/png/webp | Expose raw base64 in tool response |
| Stay within 250-image-per-product TN limit (warn, don't abort) | | |

---

## Acceptance criteria

- [ ] `add_product_images` adds images by URL and by local file path to an existing product
- [ ] `add_product_images` processes an array, returns per-image results
- [ ] `list_product_images` returns all images for a product
- [ ] `delete_product_image` removes a specific image
- [ ] `update_product_image` changes position/alt of an existing image
- [ ] `pnpm run build` succeeds with no TypeScript errors
- [ ] All 4 register functions imported and called in `src/index.ts`
- [ ] Tool count in startup log updated (25 → 29)
