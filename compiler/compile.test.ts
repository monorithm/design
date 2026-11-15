// The tests of the compiler: alias resolution, the plain forms, the axes of each token, and the contract checks.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { CompileError, compile, contexts, flatten, resolve } from './compile.ts'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const tokenMap = (tree: Parameters<typeof flatten>[0]) => new Map(flatten(tree, 'test.json').map((t) => [t.path, t]))

test('an alias resolves through a chain', () => {
  const m = tokenMap({ a: { $type: 'number', b: { $value: 1 }, c: { $value: '{a.b}' }, d: { $value: '{a.c}' } } })
  assert.equal(resolve('{a.d}', m), 1)
})

test('an alias cycle stops the compiler', () => {
  const m = tokenMap({ a: { $type: 'number', b: { $value: '{a.c}' }, c: { $value: '{a.b}' } } })
  assert.throws(() => resolve('{a.b}', m), CompileError)
})

test('an alias to no token stops the compiler', () => {
  const m = tokenMap({ a: { $type: 'number', b: { $value: '{a.none}' } } })
  assert.throws(() => resolve('{a.b}', m), /points to no token/)
})

test('a token with no type stops the compiler', () => {
  assert.throws(() => flatten({ a: { $value: 1 } }, 'test.json'), /has no \$type/)
})

test('the contexts are each combination of the axes', () => {
  const all = contexts({ base: [], axes: { theme: { contexts: { dark: [], light: [] } }, density: { contexts: { pointer: [], touch: [] } } } })
  assert.equal(all.length, 4)
  assert.deepEqual(all[0], { theme: 'dark', density: 'pointer' })
})

test('the IR gives each token one value, or one value for each context of the axes that change it', () => {
  const canonical = JSON.parse(compile().get('canonical.json') as string)
  assert.equal(canonical['opacity.disabled'].value, 0.4)
  assert.deepEqual(canonical['color.role.accent'].axes, ['theme'])
  assert.equal(canonical['color.role.accent'].values['theme=dark'].hex, '#5ca3ff')
  assert.equal(canonical['color.role.accent'].values['theme=light'].hex, '#1f6fe0')
  assert.deepEqual(canonical['size.control-unit'].axes, ['density'])
  assert.equal(canonical['size.control-unit'].values['density=touch'].value, 20)
  assert.deepEqual(canonical['spring.control'].extensions['dev.monorithm'].spring, { stiffness: 900, damping: 60, mass: 1 })
})

test('the switch contract is in the IR with no $schema field', () => {
  const contract = JSON.parse(compile().get('contracts/switch.json') as string)
  assert.equal(contract.id, 'switch')
  assert.equal(contract.$schema, undefined)
  assert.ok(contract.clauses.every((c: { id: string }) => c.id.startsWith('switch/')))
})

test('the manifest has the checksum of each file', () => {
  const files = compile()
  const manifest = JSON.parse(files.get('manifest.json') as string)
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  assert.equal(manifest.language, pkg.version)
  assert.deepEqual(Object.keys(manifest.files).sort(), [...files.keys()].filter((n) => n !== 'manifest.json').sort())
})

test('the base controls: the button sizes and the radius change with the density', () => {
  const canonical = JSON.parse(compile().get('canonical.json') as string)
  const at = (p: string, ctx: string) => canonical[p].values[`density=${ctx}`].value
  assert.deepEqual(['sm', 'md', 'lg'].map((s) => at(`size.control-${s}`, 'pointer')), [28, 32, 40])
  assert.deepEqual(['sm', 'md', 'lg'].map((s) => at(`size.control-${s}`, 'touch')), [36, 44, 52])
  assert.deepEqual([at('radius.md', 'pointer'), at('radius.md', 'touch')], [8, 10])
  assert.deepEqual([at('size.icon', 'pointer'), at('size.icon', 'touch')], [16, 20])
})

test('the base controls: a soft color keeps its alpha, and spring-quick has its spring', () => {
  const canonical = JSON.parse(compile().get('canonical.json') as string)
  assert.deepEqual(canonical['color.role.danger-soft'].values['theme=dark'], { hex: '#f2555a', srgb: [0.949, 0.3333, 0.3529], alpha: 0.14 })
  assert.equal(canonical['color.role.field-line'].values['theme=light'].hex, '#8a8a8a')
  assert.deepEqual(canonical['spring.quick'].extensions['dev.monorithm'].spring, { stiffness: 1600, damping: 80, mass: 1 })
  assert.equal(canonical['font-weight.strong'].value, 500)
  assert.equal(canonical['scale.press'].value, 0.97)
})

test('the IR has the contracts of the base controls, each with clause ids of its own contract', () => {
  const files = compile()
  for (const id of ['button', 'icon-button', 'checkbox', 'radio-group']) {
    const c = JSON.parse(files.get(`contracts/${id}.json`) as string)
    assert.equal(c.id, id)
    assert.ok(c.clauses.every((k: { id: string }) => k.id.startsWith(`${id}/`)), id)
    assert.equal(new Set(c.clauses.map((k: { id: string }) => k.id)).size, c.clauses.length, `${id}: a clause id occurs two times`)
  }
})

test('a released IR does not change: each file of each ir/<version>/ matches the checksum of its manifest', () => {
  const dir = path.join(ROOT, 'ir')
  for (const v of fs.readdirSync(dir)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, v, 'manifest.json'), 'utf8'))
    assert.equal(manifest.language, v)
    for (const [name, sum] of Object.entries(manifest.files as Record<string, string>)) {
      const actual = createHash('sha256').update(fs.readFileSync(path.join(dir, v, name))).digest('hex')
      assert.equal(actual, sum, `ir/${v}/${name}`)
    }
  }
})
