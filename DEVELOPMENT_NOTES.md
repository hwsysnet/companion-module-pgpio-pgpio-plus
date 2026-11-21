# Development notes

Background for maintainers: design decisions, known limitations and open
items. User documentation lives in [companion/HELP.md](companion/HELP.md),
the firmware contract in [PROTOCOL.md](PROTOCOL.md), and the developer quick
start in [README.md](README.md). This file does not repeat them; it explains
why things are the way they are.

## Status (1.5.0)

- Feature complete: connection handling, GPO actions (set, toggle,
  momentary, pulse, all), GPI/GPO feedbacks and variables, presets, and the
  two optional ATEM-oriented features (tally from value, GPI select), whose
  mappings are rows of dropdowns since 1.5.0, with BMD mode and Aux selection.
- `npm test` and `npm run check` pass.
- Not yet tested against a real ATEM. The tally and GPI select features are
  covered by unit tests only (see [Open items](#open-items)).
- Version history: [CHANGELOG.md](CHANGELOG.md). 1.0.0 was the first
  release; versions between 1.0.0 and 1.4.1 were never published.

### Release state (2026-11-21)

| Step                                                                                  | State                                                                        |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `v1.4.1` tagged and pushed to `github.com/hwsysnet/companion-module-pgpio-pgpio-plus` | Done                                                                         |
| `v1.5.0` tagged and pushed to `github.com/hwsysnet/companion-module-pgpio-pgpio-plus` | Done                                                                         |
| Installable package `pgpio-pgpio-plus-1.5.0.tgz` built for in-house devices           | Done                                                                         |
| Repository request on the Developer Portal                                            | Submitted 2026-11-21, awaiting review (questions arrive on the request page) |
| Push code and tags to the new Bitfocus repository                                     | Waiting                                                                      |
| Submit `v1.5.0` on the portal (_My Connections_ → _Submit Version_)                   | Waiting                                                                      |

Until the Bitfocus repository exists, the repository URLs in `package.json`,
`companion/manifest.json` and the PROTOCOL.md link in HELP.md point to a
page that does not exist yet. This is intentional: they are correct for the
published module.

### Picking up from here

Snapshot at the end of the 2026-11-21 session:

- Project location: `~/Projects/pgpio-plus` (moved from
  `~/Projects/Companion-Dev-Modules/pgpio-plus`, which no longer exists).
- Git: `main` is clean and in sync with
  `github.com/hwsysnet/companion-module-pgpio-pgpio-plus`. Tag `v1.5.0`
  points to the 1.5.0 release commit.
- `npm test` (34 tests), `npm run check`, ESLint with the Companion config
  and prettier all pass.
- `pgpio-pgpio-plus-1.5.0.tgz` is in the project root for in-house devices
  (not in git; rebuild with `npm run package`).

Next steps, in order:

1. **Wait for the repository request review.** Answer questions on the
   request page. The likely one is where the hardware can be obtained.
2. **After approval**, accept the GitHub maintainer invitation, then push
   the code to the new repository:

   ```bash
   git remote add bitfocus https://github.com/bitfocus/companion-module-pgpio-pgpio-plus.git
   git push bitfocus main
   git push bitfocus --tags
   ```

   Check that the repository URLs in `package.json` and
   `companion/manifest.json` and the PROTOCOL.md link in HELP.md now
   resolve.

3. **Submit the version** on the portal: _My Connections_ → the module →
   _Submit Version_ → `v1.5.0`. Review feedback arrives on the portal; fixes
   go out as `1.5.1` and so on, following [Releasing](#releasing).
4. Independently of the release: the [Open items](#open-items) below (real
   ATEM test, lifecycle smoke test).

## Releasing

The module is published through the Bitfocus Developer Portal
(<https://developer.bitfocus.io/>); see the Companion docs, "Releasing your
module".

1. **Repository request (first release only).** Requested on the portal's
   _Create Module Repository_ page; requests posted on Slack are no longer
   accepted. Module name: `pgpio-pgpio-plus`, which gives
   `github.com/bitfocus/companion-module-pgpio-pgpio-plus`. Any discussion
   about the request (naming, questions from the module team) happens on
   the request page. Once approved, GitHub sends a maintainer invitation.
   The new repository starts empty, so the code has to be pushed to it.
   `package.json` and `companion/manifest.json` already point to the
   Bitfocus repository URL.
2. **Each version.** Bump `version` in `package.json` (the build copies it
   into the manifest, which stays at `0.0.0`), commit, create a `v`-prefixed
   tag (e.g. `v1.4.1`) and push it. Then, on the portal: _My Connections_ →
   the module → _Submit Version_ → pick the tag. Versions are reviewed by
   volunteers; feedback arrives on the portal.
3. Before tagging: `npm test`, `npm run check`, `npm run format`, and
   `npm run package` to confirm the package builds.

### Repository request form

Answers prepared for the _Create Module Repository_ form, kept here in case
the request has to be resubmitted or the module team asks follow-up
questions.

- **Type:** Companion Connection. **TypeScript:** no (the module is
  JavaScript).
- **Module name:** `pgpio-pgpio-plus`
- **What will the module control?**
  > PGPIO+, an ESP32-based GPIO tally board with 32 GPI inputs (dry contact
  > closures) and 32 GPO outputs (relays for tally lamps). The module
  > connects as a WebSocket client using a JSON protocol, with Bonjour/mDNS
  > discovery (\_pgpio.\_tcp) and manual IP fallback. It provides GPO
  > actions (set/toggle/momentary/pulse), GPI/GPO feedbacks and variables,
  > and optional tally-from-variable (e.g. ATEM Aux) and GPI-select
  > features. Protocol:
  > https://github.com/hwsysnet/companion-module-pgpio-pgpio-plus/blob/main/PROTOCOL.md
- **Why should this be a new module?**
  > PGPIO+ is a new device with its own WebSocket/JSON protocol. No existing
  > Companion module supports it, and generic GPIO or tally modules use
  > different protocols, so there is nothing that could be extended.
- **Existing code:** https://github.com/hwsysnet/companion-module-pgpio-pgpio-plus
- **companion-module-requests issue:** none.

Expect a question on where the hardware can be obtained; have a short answer
ready (who uses the board and whether it is available to others).

### Installing a build on in-house devices

`npm run package` writes `pgpio-pgpio-plus-<version>.tgz` to the project
root (ignored by git). In Companion: _Modules_ tab → _Import module
package_ → select the file. After the import, edit each PGPIO+ connection
and select the new version if Companion does not switch to it
automatically. Existing connection settings are kept; options added since
1.0.0 default to off.

For a beta next to the live version, give `package.json` a prerelease
version (`npm version 1.5.0-beta.1 --no-git-tag-version`) and build with
`npx companion-module-build --prerelease`, which sets `isPrerelease` in the
packaged manifest. Companion keeps both versions; each connection uses the
one selected in its settings.

### Package manager

The project uses npm (`package-lock.json`). The Bitfocus template uses yarn,
but the docs do not require it. If the review asks for yarn, switch with
`corepack` and commit `yarn.lock` instead.

## Companion version compatibility

Companion decides whether it can load a module from the manifest's
`runtime.type` and `runtime.apiVersion` (the installed
`@companion-module/base` version). Per the base package's README:
**Companion 5.0 accepts base 1.0–2.1, Companion 5.1 accepts 1.0–2.2.**
Companion 5.1 ships `node18`, `node22` and `node26` runtimes, so `node26` is
fine.

That is why the base dependency is pinned to **`~2.1.3`** rather than
`^2.1.3`: a caret range would pull 2.2.x on a fresh install, which Companion
5.0 refuses to load. Move to 2.2 only when a 2.2 feature is needed and
Companion 5.0 support can be dropped.

## Set GPO: why Momentary works the way it does

### The constraint

A Companion action callback is **not told whether it runs on button press
or release**. `CompanionActionEvent` (see
`node_modules/@companion-module/base/dist/module-api/action.d.ts`) has no
phase field, and there is no "auto-release" mechanism a module can request.
Press and release only exist at the button level: a button has separate
**Press (down)** and **Release (up)** action lists
(`CompanionButtonStepActions` in `.../preset/definition.d.ts`).

### The current solution: arm/disarm

The same `Set GPO` action in Momentary mode goes into **both** lists. The
module keeps a set of armed pins (`momentaryPins` in `main.js`): the first
call arms the pin and switches it on, the matching second call disarms it
and switches it off. The `GPO n (Momentary)` presets build exactly this, and
they are the recommended way to create such a button.

The `self.log('debug', …)` line in the Momentary branch is kept on purpose:
at Companion's debug log level it shows every arm/disarm pair, which is the
quickest way to diagnose a misconfigured button.

### Rejected alternative: fixed-length pulse

Momentary was briefly implemented as a fixed-duration pulse (on, then off
after a set time), which only needs the Press list. It was dropped because
the output no longer follows how long the button is actually held. The
**Pulse GPO** action still exists for cases where a fixed length is what is
wanted.

### Known pitfalls with hand-built buttons

Both symptoms below were seen with hand-built buttons and disappeared with
the preset. The code is correct; the button configuration was not.

- **"It behaves like Toggle":** the action was only in the Press list. Each
  press then alternates between arm (on) and disarm (off).
- **"The state gets stuck":** the action was in a list more than once
  (leftover rows from earlier edits). One press then triggers two calls and
  the arm/disarm pairing breaks.

A hand-built Momentary button needs the action **exactly once** in Press and
**exactly once** in Release.

### Momentary behaviour from a Trigger

A Trigger has no "release", so the right approach depends on the source:

- **One-shot event** (e.g. an OSC/HTTP message with no matching "end"
  message): the end cannot be known, so use **Pulse GPO** with a fixed
  duration.
- **A real true/false state** (a variable or feedback that is true while
  "active"): use two Triggers, one for _becomes true_ → `Set GPO: On`, one
  for _becomes false_ → `Set GPO: Off`. No module change needed.

## Tally from value (ATEM Aux → GPO tally)

Goal: show the source currently on an ATEM Aux as tally lamps on the GPOs.
A module cannot read other modules' state, so the link is a **Companion
variable**:

- The action's `Value` field has `useVariables: true`. In base v2 Companion
  substitutes `$(atem:…)` before the callback runs; there is no
  `parseVariablesInString`.
- The mapping is a list of `value=GPO` pairs. All GPOs in the mapping form
  one group: the matching one goes on, the others off, in **one
  `set_gpo_bulk` message**, so two lamps are never lit at the same time.
- The mapping comes from the connection settings (`tally_mapping`) by
  default, or per action (`mapping_source: custom`).
- The user needs one Trigger: _On variable change_ on the ATEM Aux variable
  → _Tally from value_ (see HELP.md, "Example: ATEM Aux tally").

The ATEM variable itself **cannot** go into the connection settings: in base
v2 a module can only read its own variables, and Companion does not
substitute variables in config fields. So the Trigger stays.

Rejected alternative: two Triggers per lamp ("Aux source" feedback becomes
true/false → Set GPO On/Off). Works without code but needs 2N triggers for N
cameras.

## GPI select (GPI → ATEM Aux)

The reverse direction. The `gpi_select_mapping` setting (`value=GPI` pairs,
same parser as the tally mapping) and the `gpi_selected_value` variable:
when a mapped GPI **closes**, the variable takes the mapped value and keeps
it (latch). Only `gpi_change` rising edges count. The full `state` snapshot
is deliberately ignored, so the Aux does not switch by itself when the
connection (re)starts. The user adds a Trigger: _On variable change_
`pgpio:gpi_selected_value` → the ATEM _Aux set source_ action, with the
source field in expression mode.

Known limitation: closing the same GPI twice in a row does not change the
variable, so the Trigger does not fire again. If this becomes a problem, a
counter variable or a dedicated trigger event would solve it.

## Optional features and backwards compatibility

Both ATEM features are switched on in the connection settings
(`tally_enabled`, `gpi_select_enabled`), and both default to off, so
configurations saved with 1.0.0 behave exactly as before and no upgrade
script is needed. While a feature is off, its action or variable is **not
defined at all** (`_applyOptionalFeatures` in `main.js`, run on `init` and
`configUpdated`). Existing triggers using the action stay inactive as
"unknown action" and work again when the feature is switched back on.

## Discovery label and mDNS

Companion, not the module, browses for `_pgpio._tcp` (from `bonjourQueries`
in the manifest) and fills the **Auto-discover device** dropdown. Each entry
is labelled `${svc.name} (${address})` (webui
`BonjourDeviceInputField.tsx`), so the only way to show a per-board ID is the
mDNS instance name advertised by the firmware; PROTOCOL.md specifies
`PGPIO+ <last 3 MAC bytes>`. The earlier example used a fixed `pgpio-plus`
host name, which makes two boards conflict in mDNS. Companion uses
`@julusian/bonjour-service` without choosing an interface.

## Mapping rows in the connection settings

Companion config fields cannot form a table, so each mapping (tally:
value → GPO, GPI select: value → GPI) is a `<prefix>_count` number field
followed by 32 fixed rows of two dropdowns (`<prefix>_value_n`,
`<prefix>_gpo_n` / `<prefix>_gpi_n`), built in `mapping.js`. Rows beyond the
count are hidden with `isVisibleExpression` and ignored by
`mappingFromConfig`. The value dropdown lists ATEM source IDs (from memory,
still to be checked against a real ATEM) with `allowCustom`, so other
modules' values can be typed. A count or row that was never saved falls back
to the field defaults (4 rows, Input n → pin n), matching what the settings
page shows.

Until 1.4.1 the mappings were text fields (`tally_mapping`,
`gpi_select_mapping`, `"1=1, 2=2"`). The upgrade script in `upgrades.js`
converts them into rows and drops invalid entries, which were already
ignored. The action's **Custom** mapping is still text: a table of 64 fields
would be too large inside an action.

GPI select rows have a third dropdown, the target Aux (1-24, default 1), which
goes into `gpi_selected_aux`. A module cannot create triggers or call another
module's actions, so the ATEM switching stays in a user trigger, documented
in HELP.md (group "PGPIO+ Triggers"). The trigger watches `gpi_select_seq`,
a counter that rises on every mapped close: watching `gpi_selected_value`
missed a repeated close and a second Aux with the same source. In the ATEM
module (`src/actions/aux-outputs.ts`) the `aux` option is 1-based
(`setAuxSource(input, options.aux - 1)`) and the source field accepts
expressions; whether the `aux` dropdown can be switched to expression mode
is still to be checked, hence the per-Aux trigger fallback in HELP.md.

`bmd_mode` (default on, read through `isBmdMode`) switches the rows between
the ATEM shape (source dropdown `<prefix>_value_n`, Aux dropdown) and a
generic one (text field `<prefix>_text_n`, no Aux, no `gpi_selected_aux`).
The two value fields have separate ids, so neither mode overwrites the other;
`mappingToConfig` (used by the upgrade) fills both. A second upgrade script
writes `bmd_mode: true` into saved configs, because the settings page
evaluates `isVisibleExpression` against the saved value, not the default.

## Connection behaviour

- GPO commands update the local state optimistically, so feedbacks react
  without waiting for `gpo_ack`, but **only if the command was actually
  sent**. While disconnected, buttons keep showing the last known device
  state, and a warning is logged.
- With no discovered device and no manual IP address, the module reports
  _Bad configuration_ instead of staying in _Connecting_ forever.
- A new Pulse on a pin that is still pulsing restarts the timer; pending
  pulse timers are cleared on `destroy`. If the pulse cannot start because
  the board is offline, no delayed rest-state command is scheduled, so a
  reconnect during the pulse time cannot switch the output unexpectedly.
- "Connected" means the board has sent `hello` (`DeviceConnection.ready`).
  The Companion status, the `device_status` variable and the connection
  feedback all use this, so they always agree.
- `DeviceConnection.stop()` removes its socket listeners and therefore does
  not emit `disconnect`. `configUpdated` clears `device_status` itself,
  otherwise the old "connected" state would remain, permanently so if the
  new configuration has no address.
- Commands sent while the board is offline are dropped, not queued. Tally
  triggers should also fire on `device_status` changes (see HELP.md) so the
  tally is restored after a reconnect.

## Testing

- `npm test` (`node:test`, files in `tests/`):
  - action callbacks against a fake `self` (tally, Momentary, Pulse),
  - instance logic on an `Object.create` instance without Companion (GPI
    select, optional features, missing address),
  - `DeviceConnection` against a real in-process WebSocket server.
- `npm run check`: manifest and package structure validation.
- `npm run mock-device`: simulated board for end-to-end testing in a real
  Companion.
- Unit tests do not replace testing with real buttons in Companion. The
  Momentary pitfalls above could only be reproduced there.

## Open items

1. Test _Tally from value_ and _GPI select_ with a real ATEM. The ATEM
   module source shows `aux{N}_input_id` (1-based) and an expression-capable
   source field; still to check: whether the Aux field of _Aux/Output: Set
   source_ can be switched to expression mode, and the ATEM source IDs in
   the source list (Color Bars `1000` is not confirmed from the code).
2. Check the mapping rows in a real Companion: row visibility with the
   count and BMD mode, typing a custom value, and the upgrade of a 1.4.1
   text mapping.
3. A lifecycle smoke test (`init` / `configUpdated` / `destroy` with a fake
   `InstanceContext`) would complement the current unit tests.
