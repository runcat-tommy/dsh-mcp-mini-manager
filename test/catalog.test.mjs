/**
 * Pure catalog-logic tests.
 *
 * Everything in `lib/catalog.js` is a function over strings and plain data, so
 * these tests pin the two things that decide whether the page is honest and
 * whether a shared config file survives a write: what the YAML subset reader
 * does with a real profile patch layer, and that disabling then restoring is a
 * byte-for-byte no-op.
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import {
  MARKER_BEGIN_PREFIX,
  MARKER_END_PREFIX,
  PROFILE_PATCH_FILENAME,
  bundlePatchPaths,
  describeConfig,
  endpointOf,
  hasUnpairedMarker,
  isMcpModule,
  isRowId,
  isServerName,
  labelFromRowId,
  managedRowIdsIn,
  mcpRowsFromPatches,
  parseScalar,
  parseYamlSubset,
  planDisable,
  planRestore,
  reconcileRows,
  resolveProfileDir,
  transportOf,
} from '../lib/catalog.js'

/* ------------------------------------------------------------------ */
/* YAML subset reader                                                  */
/* ------------------------------------------------------------------ */

/** Every sandbox created in this file, torn down at the end. */
const sandboxes = []

after(() => {
  for (const directory of sandboxes) rmSync(directory, { recursive: true, force: true })
})

test('the shipped profile template parses as an empty list', () => {
  // Byte-for-byte the template `@deepseek-ai/dsh-app-boot` writes.
  const template = [
    '# Your patch layer for this dsh profile, applied after every bundle layer:',
    '# a top-level YAML array of loader patch entries (id-targeted config',
    '# overrides, disables, and insert lists; `!!js` expressions allowed).',
    '[]',
    '',
  ].join('\n')
  const parsed = parseYamlSubset(template)
  assert.deepEqual(parsed.value, [])
  assert.deepEqual(parsed.unsupported, [])
})

test('rows appended under the "[]" sentinel are read, not hidden by it', () => {
  const source = ['# mine', '[]', '', '- id: mcp-github', '  disabled: true', ''].join('\n')
  const parsed = parseYamlSubset(source)
  assert.deepEqual(parsed.value, [{ id: 'mcp-github', disabled: true }])
  assert.deepEqual(parsed.unsupported, [])
})

test('a nested config mapping and its !js expression are read structurally', () => {
  const source = [
    '- id: dsh-cube-es-mcp',
    '  config:',
    '    allowPanelWrites: !!js process.env.X === "1"',
    '    maxAffectedDocs: 200',
    '    nested:',
    '      deep: true',
    '- id: mcp-web',
    '  name: "@deepseek-ai/dsh-mcp-client"',
    '',
  ].join('\n')
  const parsed = parseYamlSubset(source)
  assert.equal(parsed.unsupported.length, 0)
  assert.equal(parsed.value.length, 2)
  assert.equal(parsed.value[0].config.allowPanelWrites.__jsExpr, 'process.env.X === "1"')
  assert.equal(parsed.value[0].config.maxAffectedDocs, 200)
  // A nested mapping must not swallow the next top-level row.
  assert.equal(parsed.value[0].config.nested.deep, true)
  assert.equal(parsed.value[1].id, 'mcp-web')
  assert.equal(parsed.value[1].name, '@deepseek-ai/dsh-mcp-client')
})

test('an insert list is read with its nested rows', () => {
  const source = [
    '- insert:',
    '    - id: mcp-a',
    "      name: '@deepseek-ai/dsh-mcp-client'",
    '      config:',
    '        serverName: a',
    '        transport: stdio',
    '    - id: mcp-b',
    "      name: '@deepseek-ai/dsh-mcp-client'",
    '',
  ].join('\n')
  const parsed = parseYamlSubset(source)
  assert.equal(parsed.unsupported.length, 0)
  assert.equal(parsed.value.length, 1)
  assert.equal(parsed.value[0].insert.length, 2)
  assert.equal(parsed.value[0].insert[0].config.serverName, 'a')
  assert.equal(parsed.value[0].insert[1].id, 'mcp-b')
})

test('comments, blank lines and inline comments never become data', () => {
  const source = [
    '# a leading comment',
    '',
    '- id: mcp-a   # trailing comment',
    '  name: "@deepseek-ai/dsh-mcp-client" # another',
    '',
    '  # an indented comment',
    '  disabled: true',
    '',
  ].join('\n')
  const parsed = parseYamlSubset(source)
  assert.deepEqual(parsed.value, [
    { id: 'mcp-a', name: '@deepseek-ai/dsh-mcp-client', disabled: true },
  ])
})

test('a "#" inside a quoted scalar is content, not a comment', () => {
  assert.equal(parseScalar('"http://x/mcp#frag"'), 'http://x/mcp#frag')
  assert.equal(parseScalar("'a # b'"), 'a # b')
  assert.equal(parseScalar('plain # dropped'), 'plain')
})

test('scalars keep their YAML types and never invent a value for !js', () => {
  assert.equal(parseScalar('true'), true)
  assert.equal(parseScalar('false'), false)
  assert.equal(parseScalar('42'), 42)
  assert.equal(parseScalar('60000'), 60000)
  assert.equal(parseScalar('null'), null)
  assert.equal(parseScalar('npx'), 'npx')
  assert.deepEqual(parseScalar('[]'), [])
  assert.deepEqual(parseScalar('{}'), {})
  assert.deepEqual(parseScalar('!!js ctx.webStartup.port ?? 3080'), {
    __jsExpr: 'ctx.webStartup.port ?? 3080',
  })
})

test('a malformed document reports trailing content instead of throwing', () => {
  const parsed = parseYamlSubset('- id: a\n  oops no colon here\n')
  assert.equal(parsed.value.length, 1)
  assert.equal(parsed.unsupported.length, 1)
  assert.match(parsed.unsupported[0], /unparsed line 2/)
})

/* ------------------------------------------------------------------ */
/* Row classification                                                  */
/* ------------------------------------------------------------------ */

test('the MCP client is recognized by specifier and by plugin name', () => {
  assert.equal(isMcpModule('@deepseek-ai/dsh-mcp-client'), true)
  assert.equal(isMcpModule('dsh-mcp-client'), true)
  assert.equal(isMcpModule('cordis:dsh-mcp-client'), true)
  assert.equal(isMcpModule('@scope/dsh-mcp-client'), true)
  assert.equal(isMcpModule('dsh-theme-manager'), false)
  assert.equal(isMcpModule(undefined), false)
})

test('row ids are validated by grammar before any filesystem use', () => {
  for (const ok of ['mcp-github', 'mcp_web', 'a.b:c', 'MCP1']) assert.equal(isRowId(ok), true, ok)
  for (const bad of ['', '..', 'a/b', 'a\\b', 'C:\\x', '../x', '-lead', 'a'.repeat(200), null, 42]) {
    assert.equal(isRowId(bad), false, String(bad))
  }
  assert.equal(isServerName('github'), true)
  assert.equal(isServerName('github-issues_1'), true)
  assert.equal(isServerName('a'.repeat(33)), false)
  assert.equal(isServerName('bad name'), false)
})

test('a row id becomes a readable label only when no name is known', () => {
  assert.equal(labelFromRowId('mcp-github'), 'github')
  assert.equal(labelFromRowId('mcp_web'), 'web')
  assert.equal(labelFromRowId('mcp:files'), 'files')
  assert.equal(labelFromRowId('github'), 'github')
  assert.equal(labelFromRowId('mcp-'), 'mcp-')
})

/* ------------------------------------------------------------------ */
/* Config description                                                  */
/* ------------------------------------------------------------------ */

test('a stdio server summarizes as its command line', () => {
  const described = describeConfig({
    serverName: 'github',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    cwd: '/tmp',
    env: { GITHUB_TOKEN: 'x' },
  })
  assert.equal(described.endpoint, 'npx -y @modelcontextprotocol/server-github')
  assert.equal(described.complete, true)
  assert.deepEqual(described.envKeys, ['GITHUB_TOKEN'])
  assert.equal(described.cwd, '/tmp')
})

test('an HTTP server summarizes as its endpoint and never leaks header values', () => {
  const described = describeConfig({
    serverName: 'web',
    transport: 'streamable-http',
    url: 'http://localhost:3000/mcp',
    headers: { Authorization: 'Bearer s3cret' },
  })
  assert.equal(described.endpoint, 'http://localhost:3000/mcp')
  assert.deepEqual(described.headerKeys, ['Authorization'])
  assert.equal(JSON.stringify(described).includes('s3cret'), false)
  assert.equal(described.complete, true)
})

test('an unknown transport or a missing name is reported incomplete', () => {
  assert.equal(describeConfig({ serverName: 'x', transport: 'sse' }).complete, false)
  assert.equal(describeConfig({ transport: 'stdio', command: 'npx' }).complete, false)
  assert.equal(describeConfig(null).complete, false)
  assert.equal(transportOf({ transport: 'sse' }), null)
  assert.equal(endpointOf({ transport: 'stdio', command: 'npx', args: [1, 'ok'] }), 'npx ok')
  assert.equal(endpointOf(null), '')
})

test('a computed config value is reported as an expression, not as its result', () => {
  const described = describeConfig({
    serverName: 'web',
    transport: 'streamable-http',
    url: { __jsExpr: 'ctx.webStartup.url' },
  })
  assert.deepEqual(described.expressionKeys, ['url'])
  assert.equal(described.endpoint, '')
})

/* ------------------------------------------------------------------ */
/* Patch-layer reading                                                 */
/* ------------------------------------------------------------------ */

const PATCH_TEXT = [
  '# mine',
  '[]',
  '',
  '- id: mcp-github',
  "  name: '@deepseek-ai/dsh-mcp-client'",
  '  config:',
  '    serverName: github',
  '    transport: stdio',
  '',
  '- id: mcp-web',
  "  name: '@deepseek-ai/dsh-mcp-client'",
  '  disabled: true',
  '',
  MARKER_BEGIN_PREFIX + 'mcp-slack',
  '# server: slack',
  '- id: mcp-slack',
  '  disabled: true',
  MARKER_END_PREFIX + 'mcp-slack',
  '',
].join('\n')

test('every MCP row in a layer is found, disabled ones included', () => {
  const { value } = parseYamlSubset(PATCH_TEXT)
  const rows = mcpRowsFromPatches(value, managedRowIdsIn(PATCH_TEXT))
  assert.deepEqual([...rows.keys()].sort(), ['mcp-github', 'mcp-slack', 'mcp-web'])
  assert.equal(rows.get('mcp-github').config.serverName, 'github')
  assert.equal(rows.get('mcp-web').disabledInLayer, true)
  assert.equal(rows.get('mcp-slack').origin, 'managed-disable')
  assert.equal(rows.get('mcp-slack').disabledInLayer, true)
})

test('a managed block is recognized by its markers, since it carries no module name', () => {
  const managed = managedRowIdsIn(PATCH_TEXT)
  assert.deepEqual([...managed], ['mcp-slack'])
  // Without the marker set the block is unidentifiable and must not be claimed.
  const blind = mcpRowsFromPatches(parseYamlSubset(PATCH_TEXT).value, new Set())
  assert.equal(blind.has('mcp-slack'), false)
})

test('an unrelated patch row is never mistaken for an MCP row', () => {
  const text = ['- id: dsh-cube-es-mcp', '  config:', '    allowPanelWrites: true', ''].join('\n')
  const rows = mcpRowsFromPatches(parseYamlSubset(text).value, managedRowIdsIn(text))
  assert.equal(rows.size, 0)
})

test('a user-layer config override for an MCP row is merged over the layer below', () => {
  const bundle = parseYamlSubset(
    ["- insert:", "    - id: mcp-cube", "      name: '@deepseek-ai/dsh-mcp-client'", '      config:', '        serverName: cube', '        transport: streamable-http', '        url: http://old/mcp', ''].join(
      '\n',
    ),
  ).value
  const user = parseYamlSubset(
    ['- id: mcp-cube', '  config:', '    serverName: cube', '    transport: streamable-http', '    url: http://new/mcp', ''].join('\n'),
  ).value
  const rows = mcpRowsFromPatches([...bundle, ...user], new Set())
  assert.equal(rows.size, 1)
  assert.equal(rows.get('mcp-cube').config.url, 'http://new/mcp')
  assert.equal(rows.get('mcp-cube').origin, 'bundle', 'a bundle row keeps its origin across a user override')
})

test('the live view wins on config while the layers keep a disabled row visible', () => {
  const fromPatches = mcpRowsFromPatches(parseYamlSubset(PATCH_TEXT).value, managedRowIdsIn(PATCH_TEXT))
  const live = [
    {
      rowId: 'mcp-github',
      serverName: 'github',
      config: { serverName: 'github', transport: 'stdio', command: 'npx' },
      disabled: false,
      fiberPhase: 'active',
    },
  ]
  const reconciled = reconcileRows(live, fromPatches)
  const byRow = Object.fromEntries(reconciled.map((row) => [row.rowId, row]))
  assert.equal(byRow['mcp-github'].fiberPhase, 'active')
  assert.equal(byRow['mcp-github'].config.command, 'npx', 'the live config is what actually connected')
  assert.equal(byRow['mcp-web'].disabledInLayer, true, 'a row only the layers know stays visible')
  assert.deepEqual(
    reconciled.map((row) => row.rowId),
    ['mcp-github', 'mcp-slack', 'mcp-web'],
    'sorted by label, then row id',
  )
})

/* ------------------------------------------------------------------ */
/* Disable / restore plans                                             */
/* ------------------------------------------------------------------ */

test('disabling appends a bracketed block and changes nothing else', () => {
  const original = ['# mine', '[]', '', '- id: other', '  config:', '    x: !!js process.env.Y', ''].join('\n')
  const plan = planDisable(original, 'mcp-github', { serverName: 'github', now: 0 })
  assert.equal(plan.ok, true)
  assert.equal(plan.action, 'append')
  assert.ok(plan.text.startsWith(original))
  assert.ok(plan.text.includes(`${MARKER_BEGIN_PREFIX}mcp-github`))
  assert.ok(plan.text.includes(`${MARKER_END_PREFIX}mcp-github`))
  assert.ok(plan.text.includes('- id: mcp-github\n  disabled: true'))
  assert.ok(plan.text.includes('# server: github'))
  assert.ok(plan.text.endsWith('\n'))
  assert.equal(plan.text.includes('!!js process.env.Y'), true)
})

test('disable then restore reproduces the original text exactly', () => {
  for (const original of [
    ['# mine', '[]', ''].join('\n'),
    ['# mine', '[]', '', '- id: other', '  config:', '    x: !!js process.env.Y', ''].join('\n'),
    ['- id: other', '  config:', '    x: 1', ''].join('\n'),
    ['# only a comment', ''].join('\n'),
  ]) {
    const disabled = planDisable(original, 'mcp-github', { serverName: 'github', now: 0 })
    assert.equal(disabled.ok, true, JSON.stringify(original))
    const restored = planRestore(disabled.text, 'mcp-github')
    assert.equal(restored.ok, true)
    assert.equal(restored.text, original, `round trip failed for ${JSON.stringify(original)}`)
  }
})

test('a layer with no trailing newline is refused rather than guessed at', () => {
  // No layer DSH writes looks like this, and appending to it would make the
  // round trip lossy, so the honest answer is to refuse.
  assert.deepEqual(planDisable('# mine\n[]', 'mcp-github', {}), {
    ok: false,
    reason: 'no-trailing-newline',
  })
  // An empty file is still a legal starting point.
  assert.equal(planDisable('', 'mcp-github', {}).ok, true)
  assert.equal(planRestore(planDisable('', 'mcp-github', {}).text, 'mcp-github').text, '')
})

test('disabling twice rewrites the managed block instead of duplicating it', () => {
  const first = planDisable('[]\n', 'mcp-github', { serverName: 'github', now: 0 })
  const second = planDisable(first.text, 'mcp-github', { serverName: 'github', now: 1 })
  assert.equal(second.ok, true)
  assert.equal(second.action, 'rewrite')
  assert.equal(second.text.split(MARKER_BEGIN_PREFIX).length - 1, 1, 'exactly one block')
  assert.equal(second.text.split('- id: mcp-github').length - 1, 1, 'exactly one row')
})

test('a hand-written disable is refused, not doubled', () => {
  const text = ['- id: mcp-github', '  disabled: true', ''].join('\n')
  assert.deepEqual(planDisable(text, 'mcp-github', {}), { ok: false, reason: 'already-patched' })
})

test('a config override for the same row does not block the disable', () => {
  // `applyEntryPatches` applies every patch independently, key by key, so a patch
  // carrying only `id` + `disabled` composes safely alongside one carrying
  // `config`. Refusing here would make every MCP row declared by a patch — which
  // is the normal `insert` form — permanently unremovable.
  const text = ['- id: mcp-github', '  config:', '    serverName: github', ''].join('\n')
  const plan = planDisable(text, 'mcp-github', { serverName: 'github', now: 0 })
  assert.equal(plan.ok, true)
  assert.equal(plan.action, 'append')
  // The existing patch is preserved byte for byte; the disable is added after it.
  assert.ok(plan.text.startsWith(text))
  assert.ok(plan.text.includes(`${MARKER_BEGIN_PREFIX}mcp-github`))
  assert.ok(plan.text.endsWith(`${MARKER_END_PREFIX}mcp-github\n`))
  assert.equal(planRestore(plan.text, 'mcp-github').text, text)
})

test('a row declared by an insert patch is also disable-able', () => {
  const text = [
    '[]',
    '',
    '- insert:',
    '    - id: mcp-github',
    '      name: "@deepseek-ai/dsh-mcp-client"',
    '      config:',
    '        serverName: github',
    '',
  ].join('\n')
  const plan = planDisable(text, 'mcp-github', { serverName: 'github', now: 0 })
  assert.equal(plan.ok, true)
  assert.equal(planRestore(plan.text, 'mcp-github').text, text)
})

test('a path-shaped or malformed row id never produces a plan', () => {
  for (const rowId of ['../x', 'a/b', '', null, 'C:\\x']) {
    assert.deepEqual(planDisable('[]\n', rowId, {}), { ok: false, reason: 'bad-row-id' })
    assert.deepEqual(planRestore('[]\n', rowId), { ok: false, reason: 'bad-row-id' })
  }
})

test('restore refuses anything it did not write', () => {
  assert.deepEqual(planRestore('[]\n', 'mcp-github'), { ok: false, reason: 'no-managed-block' })
  assert.deepEqual(
    planRestore(['- id: mcp-github', '  disabled: true', ''].join('\n'), 'mcp-github'),
    { ok: false, reason: 'no-managed-block' },
  )
})

test('an unpaired marker is detected so both verbs can refuse', () => {
  const opening = ['[]', '', `${MARKER_BEGIN_PREFIX}mcp-github`, '- id: mcp-github', '  disabled: true', ''].join('\n')
  assert.equal(hasUnpairedMarker(opening, 'mcp-github'), true)
  assert.equal(hasUnpairedMarker('[]\n', 'mcp-github'), false)
  const closed = planDisable('[]\n', 'mcp-github', {}).text
  assert.equal(hasUnpairedMarker(closed, 'mcp-github'), false)
  assert.deepEqual(planDisable(opening, 'mcp-github', {}), { ok: false, reason: 'marker-unpaired' })
  assert.deepEqual(planRestore(opening, 'mcp-github'), { ok: false, reason: 'marker-unpaired' })
})

test('restoring one row leaves another row\u2019s managed block alone', () => {
  const both = planDisable(
    planDisable('[]\n', 'mcp-a', { serverName: 'a', now: 0 }).text,
    'mcp-b',
    { serverName: 'b', now: 0 },
  ).text
  const restored = planRestore(both, 'mcp-a')
  assert.equal(restored.ok, true)
  assert.equal(restored.text.includes('mcp-b'), true)
  assert.equal(restored.text.includes('mcp-a'), false)
})

/* ------------------------------------------------------------------ */
/* Filesystem-adjacent helpers                                         */
/* ------------------------------------------------------------------ */

test('the profile layer is found through the loader base URL, and the scan is a fallback', () => {
  const home = mkdtempSync(join(tmpdir(), 'mmm-cat-'))
  sandboxes.push(home)
  const profileDir = join(home, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, PROFILE_PATCH_FILENAME), '# mine\n[]\n', 'utf8')

  // The Loader's baseUrl is the profile root, and it wins.
  const viaLoader = resolveProfileDir({ baseUrl: profileDir, home })
  assert.equal(viaLoader.dir, profileDir)
  assert.equal(viaLoader.via, 'loader-base-url')

  // A host that composed the Loader elsewhere still finds the only profile.
  const viaScan = resolveProfileDir({ home, env: {} })
  assert.equal(viaScan.dir, profileDir)
  assert.equal(viaScan.via, 'profiles-scan')

  // An explicit profile name is honoured over the scan.
  const viaEnv = resolveProfileDir({ home, env: { DSH_PROFILE: 'web' } })
  assert.equal(viaEnv.dir, profileDir)
  assert.equal(viaEnv.via, 'dsh-profile')

  // No profiles at all is not an error, just no layer to write.
  const empty = mkdtempSync(join(tmpdir(), 'mmm-cat-empty-'))
  sandboxes.push(empty)
  assert.equal(resolveProfileDir({ home: empty, env: {} }), undefined)
})

test('a profile with no manifest declares no bundles', () => {
  const home = mkdtempSync(join(tmpdir(), 'mmm-cat2-'))
  sandboxes.push(home)
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  assert.deepEqual(bundlePatchPaths(join(home, 'profiles', 'web')), [])
})
