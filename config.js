import { Regex } from '@companion-module/base'
import { mappingConfigFields } from './mapping.js'

export function getConfigFields() {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value:
				'Connects to a PGPIO+ board over WebSocket. The module tries to discover the device on the local network automatically (Bonjour/mDNS); if that does not work on your network, enter the IP address manually.',
		},
		{
			type: 'bonjour-device',
			id: 'bonjour_host',
			label: 'Auto-discover device (LAN)',
			width: 6,
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Device IP address (manual)',
			width: 6,
			regex: Regex.IP,
			default: '',
			isVisibleExpression: '!$(options:bonjour_host)',
		},
		{
			type: 'number',
			id: 'port',
			label: 'WebSocket port (manual)',
			width: 3,
			default: 32032,
			min: 1,
			max: 65535,
			isVisibleExpression: '!$(options:bonjour_host)',
		},
		{
			type: 'textinput',
			id: 'path',
			label: 'WebSocket path',
			width: 3,
			default: '/ws',
		},
		{
			type: 'number',
			id: 'reconnect_interval',
			label: 'Reconnect interval (ms)',
			width: 4,
			default: 5000,
			min: 1000,
			max: 60000,
		},
		{
			type: 'checkbox',
			id: 'bmd_mode',
			label: 'BMD mode (Blackmagic ATEM)',
			width: 12,
			default: true,
			isVisibleExpression: '$(options:tally_enabled) || $(options:gpi_select_enabled)',
			tooltip:
				'Shapes the tally and GPI select rows for a Blackmagic ATEM: the value is picked from a list of ATEM sources (other values can still be typed), and GPI select rows choose a target Aux, given in $(pgpio:gpi_selected_aux). Switch it off for other switchers or modules: the value becomes a plain text field (e.g. CAM1) and there is no Aux. Values entered in either mode are kept when switching.',
		},
		{
			type: 'checkbox',
			id: 'tally_enabled',
			label: 'Enable "Tally from value" action',
			width: 12,
			default: false,
			tooltip:
				'Adds the "Tally from value" action. It takes a value (usually a variable of another module, e.g. $(atem:aux1_input_id)), looks it up in the value → GPO rows below, switches on the matching GPO and switches off every other GPO in the mapping. Typical use: tally lamps that follow the source of an ATEM Aux. Put the action in a Trigger that runs when the variable changes. Example: rows Input 1 → GPO 1, Input 2 → GPO 2, Input 3 → GPO 3, value $(atem:aux1_input_id); when Aux 1 switches to input 2, GPO 2 turns on and GPO 1 and GPO 3 turn off; when it switches to an unmapped source (e.g. Color Bars), all three turn off. Off by default so the action list stays short.',
		},
		...mappingConfigFields('tally', 'GPO', 'tally_enabled'),
		{
			type: 'checkbox',
			id: 'gpi_select_enabled',
			label: 'Enable GPI select (gpi_selected_value variable)',
			width: 12,
			default: false,
			tooltip:
				'Adds the variables $(pgpio:gpi_selected_value), $(pgpio:gpi_select_seq) and, in BMD mode, $(pgpio:gpi_selected_aux) (the prefix is your connection label). When a GPI listed in the value → GPI → Aux rows below closes, gpi_selected_value takes the value of its row, gpi_selected_aux its Aux number (BMD mode), and gpi_select_seq rises by one. Opening a contact changes nothing. The module cannot switch the ATEM itself: create a trigger group named "PGPIO+ Triggers" on the Triggers tab, and in it a trigger on variable change of gpi_select_seq with the ATEM action Aux/Output: Set source, Aux = $(pgpio:gpi_selected_aux), source = $(pgpio:gpi_selected_value) (both in expression mode). Example (BMD mode): rows Input 1 → GPI 1 → Aux 1, Input 2 → GPI 2 → Aux 1, Input 2 → GPI 5 → Aux 2; the button on GPI 2 puts input 2 on Aux 1, the button on GPI 5 puts input 2 on Aux 2. Off by default.',
		},
		...mappingConfigFields('gpi_select', 'GPI', 'gpi_select_enabled', { aux: true }),
	]
}
