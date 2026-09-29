// Harness install gate (peerDependencies vs the running dsh version).
//
// dsh refuses to install a plugin whose manifest declares a `@deepseek-ai/dsh*`
// peer that the running dsh does not satisfy. The real implementation is
// `evaluatePluginCompatibility()` in `@deepseek-ai/dsh-app-boot`:
//
//   for (const [name, range] of Object.entries(peerDependencies))
//     if (name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
//       if (!semver.satisfies(runtimeVersion, range, { includePrerelease: true }))
//         → "incompatible-version", nothing is installed
//
// This is a manifest gate, not a code check: 0.8.23 declared only `^0.1.x`
// peers, so on dsh 0.2.0-rc.2 the install was rejected outright — the plugin
// tree never even loaded, and every feature was unavailable no matter how
// compatible the code was.
//
// The assertions below mirror that rule verbatim, so adding a dsh line to the
// peers (or dropping one by accident) fails here instead of in a user's
// install.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import semver from 'semver'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/**
 * Every dsh runtime line this plugin claims to support. Additive by design:
 * dropping a line silently breaks installs on that runtime, which is exactly
 * the bug this file exists to catch.
 */
const SUPPORTED_DSH = [
  '0.1.2-rc.1',
  '0.1.5-rc.2',
  '0.1.7-rc.2',
  '0.2.0-rc.2',
  '0.2.0',
  '0.2.7',
]

const dshPeers = Object.entries(pkg.peerDependencies ?? {}).filter(
  ([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'),
)

test('the manifest declares the dsh peers the harness gate inspects', () => {
  assert.ok(dshPeers.length > 0, 'package.json declares no @deepseek-ai/dsh* peerDependencies')
})

test('every declared dsh peer accepts every supported dsh runtime', () => {
  for (const runtime of SUPPORTED_DSH) {
    for (const [name, range] of dshPeers) {
      assert.ok(
        semver.satisfies(runtime, range, { includePrerelease: true }),
        `peerDependencies["${name}"] = "${range}" rejects dsh ${runtime}; ` +
          'dsh would refuse to install this plugin on that runtime',
      )
    }
  }
})

test('the peers also refuse a runtime that was never claimed', () => {
  // Guards the other direction: a range so wide it silently accepts an
  // unrelated major (e.g. "*" or ">=0.1.0") would hide a real break.
  for (const runtime of ['0.3.0', '1.0.0']) {
    for (const [name, range] of dshPeers) {
      assert.ok(
        !semver.satisfies(runtime, range, { includePrerelease: true }),
        `peerDependencies["${name}"] = "${range}" claims untested dsh ${runtime}`,
      )
    }
  }
})
