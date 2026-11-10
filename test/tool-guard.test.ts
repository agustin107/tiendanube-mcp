import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'

import {
  ENGINE_OWNED_TOOLS,
  ENGINE_WRITES_ALLOW,
  ENGINE_WRITES_ENV,
  guardServer,
} from '../src/tool-guard.ts'

type Handler = (...a: unknown[]) => unknown

function capture() {
  const handlers = new Map<string, Handler>()
  const fake = {
    registerTool: (name: string, ...rest: unknown[]) => {
      handlers.set(name, rest[rest.length - 1] as Handler)
    },
  }
  return { handlers, server: guardServer(fake as never) as unknown as typeof fake }
}

function withSwitch(value: string | undefined, fn: () => unknown) {
  const prev = process.env[ENGINE_WRITES_ENV]
  if (value === undefined) delete process.env[ENGINE_WRITES_ENV]
  else process.env[ENGINE_WRITES_ENV] = value
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env[ENGINE_WRITES_ENV]
    else process.env[ENGINE_WRITES_ENV] = prev
  }
}

test('engine-owned tool refuses by default without calling the API', () => {
  const { handlers, server } = capture()
  let called = 0
  server.registerTool('update_product_stock_price', {}, () => {
    called++
    return 'api'
  })
  for (const value of [undefined, '', '1', 'true', 'PERMITIR']) {
    const r = withSwitch(value, () => handlers.get('update_product_stock_price')!({})) as {
      isError: boolean
      content: Array<{ text: string }>
    }
    assert.equal(r.isError, true)
    assert.match(r.content[0].text, /sistema interno/)
  }
  assert.equal(called, 0)
})

test('engine-owned tool runs when the switch allows it', () => {
  const { handlers, server } = capture()
  server.registerTool('update_variant_stock', {}, () => 'api')
  assert.equal(withSwitch(ENGINE_WRITES_ALLOW, () => handlers.get('update_variant_stock')!({})), 'api')
})

test('tools the engine does not cover are not wrapped', () => {
  const { handlers, server } = capture()
  server.registerTool('create_coupon', {}, () => 'api')
  assert.equal(withSwitch(undefined, () => handlers.get('create_coupon')!({})), 'api')
})

test('every engine-owned name is a registered tool', async () => {
  const registered = new Set<string>()
  const fake = { registerTool: (name: string) => registered.add(name) }
  const dir = new URL('../src/tools/', import.meta.url)
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const mod = await import(new URL(file, dir).href)
    for (const [key, fn] of Object.entries(mod)) {
      if (key.startsWith('register') && typeof fn === 'function') (fn as (s: unknown) => void)(fake)
    }
  }
  assert.equal(registered.size, 84)
  for (const name of Object.keys(ENGINE_OWNED_TOOLS)) {
    assert.ok(registered.has(name), `${name} is not registered`)
  }
})
