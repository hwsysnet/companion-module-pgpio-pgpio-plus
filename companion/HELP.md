# PGPIO+

Controls the PGPIO+, an ESP32-based GPIO tally board with 32 inputs and 32
outputs. The module connects to the board over WebSocket and:

- **monitors the 32 GPI inputs** (dry contact closures) as feedbacks and
  variables, to colour buttons or drive other logic;
- **controls the 32 GPO outputs** (relays, e.g. tally lamps) with actions:
  on, off, toggle, momentary, pulse, or all at once.

Updates are event-driven, with no polling and no added delay, so the module
is suitable for control with around 0.5 s accuracy.

## Configuration

1. **Device.** The module looks for the board on the local network
   automatically (Bonjour/mDNS) and lists it under **Auto-discover device**.
   If discovery does not work on your network, leave that empty and enter
   the board's **IP address** and **port** (default `32032`). The
   **WebSocket path** defaults to `/ws`.
2. **Optional features.** Both are off by default. While a feature is off,
   its action or variable does not appear at all.
   - **Enable "Tally from value" action** with its value → GPO rows: drive tally
     lamps from a value such as an ATEM Aux source. See
     [Example: ATEM Aux tally](#example-atem-aux-tally).
   - **Enable GPI select** with its value → GPI rows: set a variable from
     GPI contacts, e.g. to switch an ATEM Aux. See
     [Example: switch an ATEM Aux from GPI](#example-switch-an-atem-aux-from-gpi).
   - **BMD mode (Blackmagic ATEM)**, on by default, shapes the rows of both
     features for an ATEM: the value is picked from a list of ATEM sources
     (other values can still be typed) and GPI select rows choose a target
     Aux. Switch it off for other switchers or modules: the value becomes a
     plain text field (e.g. `CAM1`) and there is no Aux and no
     `gpi_selected_aux` variable. Values entered in either mode are kept
     when switching.

The connection state appears in the Companion connection status, in the
**Device connection status** feedback and in the `device_status` variable.
If no device is selected and no IP address is entered, the status shows
_Bad configuration_. While the board is disconnected, output commands are
not sent and buttons keep showing the last known state of the board.

The board firmware must implement the protocol described in
[PROTOCOL.md](https://github.com/bitfocus/companion-module-pgpio-pgpio-plus/blob/main/PROTOCOL.md).

## Actions

- **Set GPO**: set one output to **Toggle** (default), **On**, **Off** or
  **Momentary**. Momentary keeps the output on only while the button is
  held. For this, the same action must be in both the button's **Press** and
  **Release** action lists, exactly once each: the press switches the output
  on, the release switches it off. The _GPO n (Momentary)_ presets are set up
  this way.
- **Pulse GPO**: switch an output on (or off), then back after the given
  time. Pulsing an output that is still pulsing restarts the timer.
- **Tally from value** (when enabled): drive a group of outputs from one
  value, for example the source currently on an ATEM Aux.
  - **Value** accepts variables, e.g. `$(atem:aux1_input_id)`.
  - **Mapping**: by default the value → GPO rows of the connection settings.
    Choose **Custom** to type it on the action as a comma separated list of
    `value=GPO` pairs, e.g. `1=1, 2=2, 3=3`.
  - The output mapped to the current value goes on and every other output
    in the mapping goes off, in a single command, so two tallies are never
    lit together. A value with no match (e.g. Color Bars) switches them all
    off.
  - Values are compared as text and are not case-sensitive, so names work
    too: `$(atem:aux1_input)` with `CAM1=1, CAM2=2`. Several values may share
    one output.
- **Set all GPO**: switch every output on or off.
- **Request full state from device**: ask the board for the current state of
  all inputs and outputs.

## Feedbacks

- **Device connection status**: true while the board is connected.
- **GPI state**: true when the selected input matches the **When ON**
  checkbox.
- **GPO state**: true when the selected output matches the **When ON**
  checkbox.

## Variables

All variables are booleans (`true` / `false`), not numbers or text.

- `device_status`: whether the board is connected.
- `gpi_1` … `gpi_32`: input states. **Open contact = `false`, closed =
  `true`.**
- `gpo_1` … `gpo_32`: output states. **Relay off = `false`, on = `true`.**
- `gpi_selected_value` (when GPI select is enabled): the mapped value of the
  last mapped input that closed. It keeps its value until another mapped
  input closes, and is empty until the first one does. This one is text.
- `gpi_selected_aux` (GPI select in BMD mode): the Aux number of the row
  of the last mapped input that closed (`1` = Aux 1); empty until the first
  one does.
- `gpi_select_seq` (when GPI select is enabled): a counter that rises by one
  on every close of a mapped input. Watch this one in a trigger.

## Presets

The Presets tab has a ready-made button for every input and output, plus two
for each output:

- **GPO n**: toggles the output on press. It stays on or off after release.
- **GPO n (Momentary)**: the output is on only while the button is held.

## Example: ATEM Aux tally

To light the tally lamp of the source currently on an ATEM Aux output:

1. In the connection settings, tick **Enable "Tally from value" action**,
   set **Number of entries** and pick a source and a GPO in each row, e.g.
   Input 1 → GPO 1, Input 2 → GPO 2. The source list holds the usual ATEM
   sources; any other value can be typed in.
2. On the Triggers tab, create a trigger with the event **On variable
   change** on the ATEM Aux source variable, e.g. `atem:aux1_input_id`
   (check the exact name in the Variables list of your ATEM connection).
3. Add the action **Tally from value** with Value `$(atem:aux1_input_id)`
   and Mapping **From connection settings**.
4. Add two more events to the same trigger: **On startup**, so the tally is
   correct as soon as Companion starts, and **On variable change** on
   `pgpio:device_status`, so it is restored when the board reconnects (an
   Aux change made while the board was offline is otherwise missed).

The mapping can then be changed in the connection settings without touching
the trigger. The trigger itself is needed because a connection's settings
cannot read another module's variables. For several Aux outputs, use one
trigger per Aux, each with its own custom mapping.

## Example: switch an ATEM Aux from GPI

The reverse direction, where GPI contacts select the source of one or more
ATEM Aux outputs:

1. In the connection settings, tick **Enable GPI select**, leave **BMD
   mode** on, set **Number of entries** and fill in each row:
   source → GPI → Aux, e.g.
   Input 1 → GPI 1 → Aux 1, Input 2 → GPI 2 → Aux 1, Input 2 → GPI 5 → Aux 2.
   When a listed GPI closes:
   - `gpi_selected_value` takes the source of its row (the ATEM source ID,
     e.g. `2`),
   - `gpi_selected_aux` takes its Aux number (`1` = Aux 1),
   - `gpi_select_seq` rises by one, on every close, even when the same GPI
     closes again.
2. The module cannot switch the ATEM itself; a trigger does that. On the
   Triggers tab, create a group named **PGPIO+ Triggers** to keep the
   triggers that belong to this module together.
3. In that group, create a trigger with the event **On variable change** on
   `pgpio:gpi_select_seq` (use your connection's label instead of `pgpio`),
   and the ATEM connection's **Aux/Output: Set source** action. Switch both
   fields to expression mode: Aux `$(pgpio:gpi_selected_aux)`, source
   `$(pgpio:gpi_selected_value)`.
4. If the Aux field of your ATEM module version cannot be switched to
   expression mode, create one trigger per Aux instead, each with the same
   event, a fixed Aux in the action and the condition
   `$(pgpio:gpi_selected_aux) == 2` (the Aux number of that trigger).

Combined with the Aux tally example, the tally follows the switch.
