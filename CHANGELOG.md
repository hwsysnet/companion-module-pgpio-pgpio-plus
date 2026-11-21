# Changelog

## 1.4.1 (2026-11-21)

First version prepared for publication through the Bitfocus Developer
Portal.

### Added

- **Tally from value** action: drives a group of GPOs from a value, such as
  the source on an ATEM Aux. The matching output goes on and the rest of the
  group goes off in a single command. The mapping comes from the connection
  settings or from the action.
- **GPI select**: the `gpi_selected_value` variable takes the mapped value
  of the last GPI that closed, e.g. to switch an ATEM Aux from contacts.
- Both features are opt-in in the connection settings and off by default,
  so existing configurations behave as before.

### Fixed

- Buttons no longer show an output as on when the command could not be sent
  because the board was offline.
- The connection status, the `device_status` variable and the connection
  feedback now agree, and are cleared when the connection settings change.
- The module reports _Bad configuration_ when no device is discovered or
  entered, instead of staying in _Connecting_.
- Pulsing an output that is still pulsing restarts the timer instead of
  ending the new pulse early. A pulse that cannot start while offline no
  longer sends its delayed command after a reconnect.
- A warning is logged if the board reports a pin count other than 32/32.

### Changed

- `@companion-module/base` pinned to `~2.1.3` to keep Companion 5.0
  support.
- Documentation (HELP, README, protocol, development notes) revised and
  fully in English.
- Unit tests (`npm test`) and the Companion prettier configuration added.

## 1.0.0

Initial release: WebSocket connection with Bonjour/mDNS discovery, Set GPO
(toggle, on, off, momentary), Pulse GPO, Set all GPO, GPI/GPO feedbacks and
variables, and presets for every pin.
