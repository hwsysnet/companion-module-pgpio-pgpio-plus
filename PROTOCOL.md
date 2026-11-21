# PGPIO+ WebSocket protocol (v1)

This document specifies the protocol between this Companion module and the
PGPIO+ board firmware. It is the only contract the module relies on, so the
firmware can be implemented with any stack (Arduino, ESP-IDF, …) as long as
it follows this specification.

## Overview

- The **PGPIO+ is the WebSocket server**, the Companion module is the
  **client**. The board's address, port and WebSocket path are set in the
  module's connection settings, or found automatically via mDNS (see below).
- Recommended defaults: path **`/ws`**, port **`32032`**. Both can be
  changed.
- The board only needs to serve **one client at a time**. When a new client
  connects, it may close the previous connection.
- Every message is a **single JSON object in a single WebSocket text
  frame**. There is no line framing (no trailing `\n`); the frame is the
  delimiter.
- Pin numbers are **0-based on the wire** (`0`–`31`) and **1-based in the
  Companion UI** (`GPI 1`–`GPI 32`, `GPO 1`–`GPO 32`). UI "GPI 1" is wire
  `pin: 0`.
- **GPI** are the board's inputs (dry contact closures), **GPO** its outputs
  (relays or transistor outputs, e.g. for tally lamps).

### Logical polarity

Every feedback and variable in Companion depends on this, so the firmware
must follow it exactly, in both directions:

|         | Open                                                       | Closed                                                       |
| ------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| **GPI** | contact open, not conducting → `state: 0` (`false`)        | contact closed, conducting → `state: 1` (`true`)             |
| **GPO** | output/relay released, circuit open → `state: 0` (`false`) | output/relay energised, circuit closed → `state: 1` (`true`) |

In short: **open = `0` / `false`, closed = `1` / `true`.** This applies to
the `gpi_change`, `state` and `gpo_ack` messages the board sends, and to the
`state` field of the `set_gpo` / `set_gpo_bulk` commands it receives
(`1` = close the output, `0` = open it).

## Discovery (Bonjour / mDNS)

Users do not have to enter the board's IP address: the module looks for it on
the local network via mDNS. Manual IP and port entry remains available as a
fallback, so mDNS support is recommended but not required.

To be discoverable, the firmware advertises an mDNS service with:

- **Service type:** `_pgpio._tcp` (full name `_pgpio._tcp.local.`)
- **Port:** the port the WebSocket server actually listens on (default
  `32032`)
- **TXT records:** none required today. If more PGPIO+ models appear, a
  `model` TXT field is the recommended way to tell them apart.

Arduino / ESP32 (`ESPmDNS`):

```cpp
#include <ESPmDNS.h>

void setup() {
  // ... after WiFi.begin() has connected:
  if (MDNS.begin("pgpio-plus")) {           // any hostname
    MDNS.addService("pgpio", "tcp", 32032);  // "pgpio", not "_pgpio": the library adds the underscore
  }
}
```

ESP-IDF (`mdns` component):

```c
mdns_init();
mdns_hostname_set("pgpio-plus");
mdns_service_add(NULL, "_pgpio", "_tcp", 32032, NULL, 0);
```

## Connection lifecycle

1. The module opens `ws://<host>:<port><path>`.
2. Right after the connection opens, the board sends a `hello` message,
   followed by a full `state` snapshot.
3. After that the board only sends `gpi_change` events when an input
   changes. No polling, no periodic resending of the full state.
4. The module sends a `ping` every 10 seconds; the board answers with
   `pong`. If the module receives nothing at all from the board for 15
   seconds (neither `pong` nor any other message), it considers the
   connection dead and reconnects.
5. When the connection drops, the module retries automatically (every 5
   seconds by default, configurable).
6. Each reconnection starts again at step 1 (`hello` + full `state`).

## Board → module messages

### `hello`

Required, once, immediately after the connection opens.

```json
{
	"type": "hello",
	"device": "pgpio-plus",
	"fw_version": "1.0.0",
	"gpi_count": 32,
	"gpo_count": 32
}
```

The module works with a fixed 32 inputs and 32 outputs. If `gpi_count` or
`gpo_count` differs, it logs a warning and carries on: missing pins read as
open, pins above 32 are ignored.

### `state`: full snapshot

Required right after `hello`, and whenever the module sends `get_state`.

```json
{
	"type": "state",
	"gpi": [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	"gpo": [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}
```

- Both arrays have exactly 32 elements, each `0` or `1`.
- `gpi[i]` / `gpo[i]` is the state of input/output `i` (0-based).

### `gpi_change`: one input changed

Sent every time a GPI changes state. Debouncing is the board's job; the
module does not debounce.

```json
{ "type": "gpi_change", "pin": 4, "state": 1 }
```

- `pin`: 0-based index (0–31).
- `state`: `0` (open) or `1` (closed), see [Logical polarity](#logical-polarity).
- An optional `ts` field (board uptime in ms) is allowed and ignored.

### `gpo_ack`: output confirmation (recommended, optional)

After executing a `set_gpo` command the board may confirm the new state:

```json
{ "type": "gpo_ack", "pin": 10, "state": 1 }
```

Without it, the module treats the value it sent as the current state.

### `pong`

Answer to `ping`, used as a keep-alive:

```json
{ "type": "pong" }
```

### `error` (optional)

```json
{ "type": "error", "message": "description of the problem" }
```

The module only logs it.

## Module → board messages

### `set_gpo`: set one output

```json
{ "type": "set_gpo", "pin": 10, "state": 1 }
```

`state`: `1` closes the output (relay energised), `0` opens it.

### `set_gpo_bulk`: set several outputs at once

```json
{
	"type": "set_gpo_bulk",
	"pins": [
		{ "pin": 0, "state": 1 },
		{ "pin": 1, "state": 0 },
		{ "pin": 2, "state": 1 }
	]
}
```

Used for "all outputs on/off" and for tally groups, where switching one lamp
on and the others off must happen together. The board should apply all
listed pins in one go, without visible intermediate states. A reply is
optional: the board may answer with a `state` snapshot or with one `gpo_ack`
per pin, or not at all.

### `get_state`: request the full state

```json
{ "type": "get_state" }
```

The board answers with a `state` message.

### `ping`

```json
{ "type": "ping" }
```

The board answers with `pong`.

## Robustness and timing requirements

- Ignore incoming messages that are not valid JSON or have an unknown
  `type`. They must never crash the firmware.
- If two clients try to connect, serving the most recent one is enough; the
  older connection may be closed.
- Debouncing of GPI contacts is the board's responsibility; the module
  processes every `gpi_change` immediately.
- **Timing is critical.** The system is used for control with roughly 0.5 s
  accuracy (e.g. tally switching during a live show), so:
  - Keep the debounce time short (about 5–20 ms): enough to filter contact
    bounce, too short to notice.
  - Send each `gpi_change` as soon as the debounced input changes. Do not
    collect changes and send them from a periodic loop (e.g. every 100 ms);
    every change produces its own message immediately.
  - Execute `set_gpo` commands as soon as they arrive, then send `gpo_ack`
    (if supported) right away.
- If WiFi drops, the board reconnects on its own and restarts the WebSocket
  server as soon as the network is back.

## Example exchange

```
Board accepts the connection
Board:  {"type":"hello","device":"pgpio-plus","fw_version":"1.0.0","gpi_count":32,"gpo_count":32}
Board:  {"type":"state","gpi":[0,0,...0],"gpo":[0,0,...0]}

(a Companion button switches GPO 3 on)
Module: {"type":"set_gpo","pin":2,"state":1}
Board:  {"type":"gpo_ack","pin":2,"state":1}   (optional)

(a contact on GPI 5 closes)
Board:  {"type":"gpi_change","pin":4,"state":1}

(10 s later, keep-alive)
Module: {"type":"ping"}
Board:  {"type":"pong"}
```

## Testing without hardware

`mock-device/mock-esp32.js` is a minimal WebSocket server that speaks this
protocol: it generates random GPI changes and logs the commands it receives.
Use it to test the module without a board, or as a reference when writing
the firmware:

```bash
npm run mock-device
```
