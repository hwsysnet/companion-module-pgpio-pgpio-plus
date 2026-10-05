# PGPIO+

This module controls the PGPIO+, a custom ESP32-based GPIO tally board. The
module connects to the board as a WebSocket client and:

- **monitors 32 GPI inputs** (contact closures / dry contacts) — exposed as
  feedbacks and variables to drive button colours or other logic.
- **controls 32 GPO outputs** (relay / tally lamp outputs) — via actions
  (on / off / toggle / momentary / pulse, or set all).

All feedbacks and variables are **real-time** (event-driven, no polling or
added delay), suitable for control with ~0.5 s accuracy.

## Configuration

1. The module tries to **discover the PGPIO+ board on the local network
   automatically** (Bonjour/mDNS). If discovery works, there is no need to
   enter an IP address. If Bonjour does not work on your network, enter the
   IP address and port manually (default port: **32032**), plus the
   WebSocket path (default: `/ws`).
2. The device must implement the WebSocket protocol described in
   `PROTOCOL.md` in the module's repository and, for auto-discovery,
   advertise itself via mDNS.
3. The connection state is shown in the Companion connection status, in the
   **Device connection status** feedback and in the `device_status`
   variable.

## Actions

- **Set GPO** — set a single output: **Toggle** (default), **On**, **Off**,
  or **Momentary** (doorbell style: the output is `On` only while the button
  is held). For Momentary mode, add the same action to both the button's
  **Press (down)** and **Release (up)** action lists — the first call
  (press) switches the output on, the second (release) switches it back
  off. A ready-made preset is provided (see below).
- **Pulse GPO** — switch an output on, then automatically off again after
  the given duration.
- **Set all GPO** — switch all outputs on or off at once.
- **Request full state** — request the complete state from the device.

## Presets

Every GPI/GPO pin has a ready-made button (Presets tab); for each GPO there
are two:

- **GPO n** — runs "Set GPO" in Toggle mode on press (switches the output
  on/off, and it stays that way after the button is released).
- **GPO n (Momentary)** — doorbell style: the output is active (`On`)
  **only while** the button is held, and returns to `Off` on release. It
  puts "Set GPO" in **Momentary** mode into both the Press (down) **and**
  Release (up) action lists (the same action in both). You can build the
  same thing by hand on any button.

## Feedbacks

- **Device connection status** — true while the PGPIO+ is connected.
- **GPI state** — true when the selected GPI input matches the "When ON"
  checkbox.
- **GPO state** — true when the selected GPO output matches the "When ON"
  checkbox.

## Variables

All variables are real **boolean** values (`true`/`false`), not numbers or
text:

- `device_status` — whether the PGPIO+ is connected.
- `gpi_1` .. `gpi_32` — current state of each GPI input:
  **open contact = `false`, closed contact = `true`**.
- `gpo_1` .. `gpo_32` — current state of each GPO output:
  **open (relay off) = `false`, closed (relay on) = `true`**.
