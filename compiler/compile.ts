// The compiler of the language source. It reads source/ and contracts/, examines them, and writes the intermediate
// form (IR) of the language version to ir/<version>/.
//
//   node compiler/compile.ts           write ir/<version>/
//   node compiler/compile.ts --check   compile into memory and fail if ir/<version>/ differs (the drift check of CI)
//
// The checks: each contract matches schemas/contract.schema.json; each token reference of a contract exists; each alias
// resolves, with no cycle; each token has a known type. The IR has no alias: each value is in its plain form.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Ajv2020Module from 'ajv/dist/2020.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const COMPILER_VERSION = '0.3.0'

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
interface Token {
  path: string
  type: string
  value: Json
  description?: string
  extensions?: Json
  file: string
}
interface Axes {
  base: string[]
  axes: Record<string, { contexts: Record<string, string[]> }>
}

export class CompileError extends Error {}

const read = (file: string): Json => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))

/** The tokens of one DTCG file, flat. A group passes its $type to its children. */
export function flatten(tree: Json, file: string, prefix = '', inherited?: string): Token[] {
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) return []
  const node = tree as Record<string, Json>
  const type = typeof node.$type === 'string' ? node.$type : inherited
  if ('$value' in node) {
    if (!type) throw new CompileError(`${file}: the token ${prefix} has no $type`)
    return [{ path: prefix, type, value: node.$value, description: node.$description as string | undefined, extensions: node.$extensions, file }]
  }
  const out: Token[] = []
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue
    out.push(...flatten(child, file, prefix ? `${prefix}.${key}` : key, type))
  }
  return out
}

/** The contexts: each combination of one context of each axis, as { axis: context }. */
export function contexts(axes: Axes): Record<string, string>[] {
  let out: Record<string, string>[] = [{}]
  for (const [axis, { contexts: ctx }] of Object.entries(axes.axes)) {
    out = out.flatMap((c) => Object.keys(ctx).map((name) => ({ ...c, [axis]: name })))
  }
  return out
}

const ALIAS = /^\{([a-z0-9-]+(?:\.[a-z0-9-]+)+)\}$/

/** Resolves the aliases of a value in one context. A whole value can be an alias, or a part of a composite value. */
export function resolve(value: Json, tokens: Map<string, Token>, trail: string[] = []): Json {
  if (typeof value === 'string') {
    const m = ALIAS.exec(value)
    if (!m) return value
    const ref = m[1] as string
    if (trail.includes(ref)) throw new CompileError(`An alias cycle: ${[...trail, ref].join(' -> ')}`)
    const target = tokens.get(ref)
    if (!target) throw new CompileError(`The alias {${ref}} points to no token${trail.length ? ` (from ${trail.at(-1)})` : ''}`)
    return resolve(target.value, tokens, [...trail, ref])
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, tokens, trail))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, tokens, trail)]))
  return value
}

/** The plain form of a resolved value. Color: hex, sRGB components, alpha. Dimension and duration: a number and a unit. */
export function plain(type: string, value: Json): Json {
  switch (type) {
    case 'color': {
      const c = value as { hex?: string; components?: number[]; alpha?: number }
      if (!c.hex || !c.components) throw new CompileError(`A color needs hex and components: ${JSON.stringify(value)}`)
      return { hex: c.hex.toLowerCase(), srgb: c.components, alpha: c.alpha ?? 1 }
    }
    case 'dimension':
    case 'duration':
      return value
    case 'number':
    case 'fontWeight':
    case 'cubicBezier':
      return value
    case 'shadow': {
      // A shadow is one layer or a list of layers (DTCG 2025.10).
      const layer = (s: Record<string, Json>): Json => ({ ...s, color: plain('color', s.color as Json) })
      return Array.isArray(value) ? value.map((v) => layer(v as Record<string, Json>)) : layer(value as Record<string, Json>)
    }
    case 'transition':
      return value
    default:
      throw new CompileError(`The type ${type} is not known to the compiler`)
  }
}

const sameJson = (a: Json, b: Json): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Compiles the source into the files of the IR, as a map from a file name to its text. */
export function compile(): Map<string, string> {
  const pkg = read('package.json') as { version: string }
  const axes = read('source/axes.json') as unknown as Axes
  const all = contexts(axes)
  const axisNames = Object.keys(axes.axes)

  // The resolved tokens of each context.
  const resolved: { ctx: Record<string, string>; values: Map<string, { type: string; value: Json; token: Token }> }[] = []
  for (const ctx of all) {
    const files = [...axes.base, ...axisNames.flatMap((a) => axes.axes[a]?.contexts[ctx[a] as string] ?? [])]
    const tokens = new Map<string, Token>()
    for (const f of files) for (const t of flatten(read(`source/${f}`), f)) tokens.set(t.path, t)
    const values = new Map<string, { type: string; value: Json; token: Token }>()
    for (const t of tokens.values()) values.set(t.path, { type: t.type, value: plain(t.type, resolve(t.value, tokens, [t.path])), token: t })
    resolved.push({ ctx, values })
  }

  // canonical.json: one value, or one value for each context of the axes that change the token.
  const paths = [...new Set(resolved.flatMap((r) => [...r.values.keys()]))].sort()
  const canonical: Record<string, Json> = {}
  for (const p of paths) {
    const per = resolved.map((r) => ({ ctx: r.ctx, v: r.values.get(p) }))
    if (per.some((x) => !x.v)) throw new CompileError(`The token ${p} is missing in a context`)
    const first = per[0]?.v
    if (!first) continue
    const varying = axisNames.filter((a) =>
      per.some((x) => per.some((y) => x.ctx[a] !== y.ctx[a] && axisNames.every((b) => b === a || x.ctx[b] === y.ctx[b]) && !sameJson(x.v?.value ?? null, y.v?.value ?? null))),
    )
    const entry: Record<string, Json> = { type: first.type }
    if (first.token.description) entry.description = first.token.description
    if (first.token.extensions) entry.extensions = first.token.extensions
    if (!varying.length) entry.value = first.value
    else {
      const byKey: Record<string, Json> = {}
      for (const x of per) {
        const key = varying.map((a) => `${a}=${x.ctx[a]}`).join(',')
        byKey[key] = x.v?.value ?? null
      }
      entry.axes = varying
      entry.values = byKey
    }
    canonical[p] = entry
  }

  // The contracts: the schema, then the token references and the geometry references.
  const Ajv2020 = (Ajv2020Module as unknown as { default?: unknown }).default ?? Ajv2020Module
  const ajv = new (Ajv2020 as new (o: object) => { compile: (s: Json) => ((d: Json) => boolean) & { errors?: unknown } })({ allErrors: true, strict: true })
  const validate = ajv.compile(read('schemas/contract.schema.json'))
  const contracts: Record<string, Json> = {}
  for (const f of fs.readdirSync(path.join(ROOT, 'contracts')).filter((n) => n.endsWith('.json')).sort()) {
    const c = read(`contracts/${f}`) as Record<string, Json>
    if (!validate(c)) throw new CompileError(`contracts/${f}: ${JSON.stringify(validate.errors)}`)
    for (const [part, ref] of Object.entries(c.tokens as Record<string, string>)) {
      if (!(ref in canonical)) throw new CompileError(`contracts/${f}: ${part} points to the token ${ref}, which does not exist`)
    }
    for (const [part, g] of Object.entries(c.geometry as Record<string, { of?: string }>)) {
      if (g.of && !(g.of in canonical)) throw new CompileError(`contracts/${f}: ${part} is a multiple of ${g.of}, which does not exist`)
    }
    const { $schema: _schema, ...body } = c
    contracts[`contracts/${f}`] = body
  }

  const axesOut: Json = Object.fromEntries(
    axisNames.map((a) => {
      const names = Object.keys(axes.axes[a]?.contexts ?? {})
      return [a, { contexts: names, default: names[0] ?? null }]
    }),
  )
  const files = new Map<string, string>()
  const text = (d: Json): string => `${JSON.stringify(d, null, 2)}\n`
  files.set('axes.json', text(axesOut))
  files.set('canonical.json', text(canonical))
  for (const [name, c] of Object.entries(contracts)) files.set(name, text(c))
  const sums = Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([n, t]) => [n, crypto.createHash('sha256').update(t).digest('hex')]))
  files.set('manifest.json', text({ language: pkg.version, compiler: COMPILER_VERSION, schemas: ['contract.schema.json'], files: sums }))
  return files
}

function main(): void {
  const check = process.argv.includes('--check')
  const version = (read('package.json') as { version: string }).version
  const dir = path.join(ROOT, 'ir', version)
  const files = compile()
  if (check) {
    const diff: string[] = []
    for (const [name, t] of files) {
      const p = path.join(dir, name)
      if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== t) diff.push(name)
    }
    if (diff.length) {
      console.error(`The IR in ir/${version}/ differs from the source: ${diff.join(', ')}. Run: yarn build`)
      process.exit(1)
    }
    console.log(`The IR in ir/${version}/ matches the source (${files.size} files).`)
    return
  }
  fs.rmSync(dir, { recursive: true, force: true })
  for (const [name, t] of files) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    fs.writeFileSync(path.join(dir, name), t)
  }
  console.log(`Wrote ir/${version}/: ${[...files.keys()].join(', ')}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main()
  } catch (e) {
    if (e instanceof CompileError) {
      console.error(`compile: ${e.message}`)
      process.exit(1)
    }
    throw e
  }
}
