# companion-module-pgpio-pgpio-plus

[Bitfocus Companion](https://bitfocus.io/companion) module for the **PGPIO+**,
a custom ESP32-based GPIO tally board. The module connects to the board as a
WebSocket client, monitors its **32 GPI** inputs and controls its **32 GPO**
outputs.

- User documentation (actions, feedbacks, variables, presets):
  [companion/HELP.md](companion/HELP.md)
- WebSocket protocol the firmware must implement: [PROTOCOL.md](PROTOCOL.md)
  (Hungarian)
- Design decisions and open items: [DEVELOPMENT_NOTES.md](DEVELOPMENT_NOTES.md)
  (Hungarian)

## Development quick start

```bash
npm install

# validate manifest.json / package.json against Companion's requirements
npm run check

# start a simulated ESP32 board (no real hardware needed)
npm run mock-device

# build an installable package (.tgz) for "Import module package"
npm run package
```

### Loading the module in Companion as a developer module

1. In the Companion Launcher open the **cog icon** → *Advanced Settings*.
2. Under **Developer**, select the **parent folder** that contains this
   module's folder (not the module folder itself). Use a small, dedicated
   folder — pointing it at a large projects directory can make Companion
   hang while scanning. Do not use a symlink for the module folder;
   Companion does not follow it and reports "Module files missing".
3. Enable **Enable Developer Modules**.
4. *Launch GUI* and add **PGPIO+** from the Connections list.

To connect to the mock device (it does not advertise via Bonjour), enter
manually:

- Host: `127.0.0.1`
- Port: `32032`
- Path: `/ws`

## File structure

| File | Purpose |
|---|---|
| `main.js` | Module entry point (`InstanceBase`), wires everything together |
| `device-connection.js` | WebSocket connection, protocol implementation, state cache |
| `config.js` | Companion config fields (Bonjour, IP, port, path, reconnect) |
| `actions.js` | GPO actions (Set / Pulse / Set all / Request state) |
| `feedbacks.js` | Button feedbacks based on GPI/GPO and connection state |
| `variables.js` | `device_status`, `gpi_1..32`, `gpo_1..32` variables |
| `presets.js` | Ready-made buttons for every GPI/GPO pin |
| `upgrades.js` | Upgrade scripts between versions (currently empty) |
| `mock-device/mock-esp32.js` | Simulated ESP32 for local testing |

## Notes for contributors

- `runtime.entrypoint` in `companion/manifest.json` is **relative to the
  `companion/` folder**, hence `"../main.js"`.
- The module uses the `@companion-module/base` **v2** API:
  - no `runEntrypoint`; `main.js` default-exports the `InstanceBase`
    subclass and re-exports `UpgradeScripts` as a named export;
  - `setVariableDefinitions` takes an object (`{ gpi_1: { name } }`), not an
    array;
  - `setPresetDefinitions(structure, presets)` takes two arguments, presets
    are `type: 'simple'`;
  - `init(config, isFirstInit, secrets)` / `configUpdated(config, secrets)`.
- All variables are real booleans (`true`/`false`). Updates are
  event-driven, with no polling or debouncing in the module.
- Bonjour discovery: the `bonjour_host` config value is `"ip:port"` or
  `null`; when set it overrides the manual host/port fields. Default port is
  `32032`.

## License

MIT — see [LICENSE](LICENSE).
