# companion-module-pgpio-pgpio-plus

[Bitfocus Companion](https://bitfocus.io/companion) module for the **PGPIO+**,
an ESP32-based GPIO tally board. The module connects to the board as a
WebSocket client, monitors its **32 GPI** inputs and controls its **32 GPO**
outputs.

- User documentation (actions, feedbacks, variables, presets, examples):
  [companion/HELP.md](companion/HELP.md)
- WebSocket protocol the firmware implements: [PROTOCOL.md](PROTOCOL.md)
- Version history: [CHANGELOG.md](CHANGELOG.md)
- Design decisions, release process and open items:
  [DEVELOPMENT_NOTES.md](DEVELOPMENT_NOTES.md)

## Development

```bash
npm install

npm test               # unit tests (node:test)
npm run check          # validate manifest.json / package.json for Companion
npm run format         # format with the Companion prettier config
npm run mock-device    # simulated PGPIO+ board, no hardware needed
npm run package        # build the installable .tgz package
```

### Installing a build

`npm run package` writes `pgpio-pgpio-plus-<version>.tgz` to the project
root. In Companion, open the _Modules_ tab, choose _Import module package_
and select the file. Existing connections keep their settings.

### Running the module in Companion as a developer module

1. In the Companion Launcher, open the **cog icon** → _Advanced Settings_.
2. Under **Developer**, select the **parent folder** of this module's folder,
   not the module folder itself. Use a small, dedicated folder: pointing it
   at a large projects directory can make Companion hang while scanning.
   Do not symlink the module folder; Companion does not follow symlinks and
   reports "Module files missing".
3. Enable **Enable Developer Modules**.
4. _Launch GUI_ and add **PGPIO+** from the connections list.

The mock board does not advertise itself via mDNS, so enter its address
manually: host `127.0.0.1`, port `32032`, path `/ws`.

## File structure

| File                        | Purpose                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `main.js`                   | Module entry point (`InstanceBase`); wires everything together, optional features, GPI select |
| `device-connection.js`      | WebSocket connection, protocol implementation, state cache                                    |
| `config.js`                 | Connection settings: discovery, IP, port, path, reconnect, optional features                  |
| `actions.js`                | Set GPO, Pulse GPO, Tally from value, Set all GPO, Request state                              |
| `feedbacks.js`              | Connection, GPI and GPO state feedbacks                                                       |
| `variables.js`              | `device_status`, `gpi_1..32`, `gpo_1..32`, `gpi_selected_value`                               |
| `presets.js`                | Ready-made buttons for every GPI/GPO pin                                                      |
| `upgrades.js`               | Config upgrade scripts (none needed so far)                                                   |
| `tests/`                    | Unit tests                                                                                    |
| `mock-device/mock-esp32.js` | Simulated board for local testing                                                             |

## Notes for contributors

- `runtime.entrypoint` in `companion/manifest.json` is relative to the
  `companion/` folder, hence `"../main.js"`.
- `@companion-module/base` is pinned to `~2.1.3` so the module still loads
  in Companion 5.0. See DEVELOPMENT_NOTES.md before upgrading it.
- The module uses the base **v2** API:
  - `main.js` default-exports the `InstanceBase` subclass and re-exports
    `UpgradeScripts`; there is no `runEntrypoint`;
  - `setVariableDefinitions` takes an object (`{ gpi_1: { name } }`), not
    an array;
  - `setPresetDefinitions(structure, presets)` takes two arguments, presets
    are `type: 'simple'`;
  - `init(config, isFirstInit, secrets)` / `configUpdated(config, secrets)`.
- Variables are real booleans. Updates are event-driven, with no polling or
  debouncing in the module.
- Discovery: the `bonjour_host` config value is `"ip:port"` or empty; when
  set it overrides the manual host and port.

## Releasing

Bump `version` in `package.json`, commit, tag `vX.Y.Z`, push the tag, then
submit the version on the [Bitfocus Developer Portal](https://developer.bitfocus.io/).
Details in [DEVELOPMENT_NOTES.md](DEVELOPMENT_NOTES.md#releasing).

## License

MIT, see [LICENSE](LICENSE).
