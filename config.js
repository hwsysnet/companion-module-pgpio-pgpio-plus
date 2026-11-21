import { Regex } from '@companion-module/base'

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
			id: 'tally_enabled',
			label: 'Enable "Tally from value" action',
			width: 12,
			default: false,
			tooltip: 'Drive a group of GPOs from a value, e.g. the source of an ATEM Aux',
		},
		{
			type: 'textinput',
			id: 'tally_mapping',
			label: 'Tally mapping (value=GPO, ...)',
			width: 12,
			isVisibleExpression: '$(options:tally_enabled)',
			default: '',
			tooltip:
				'Default mapping for the "Tally from value" action, e.g. "1=1, 2=2, 3=3" (value = ATEM input ID). The GPO mapped to the current value is switched on, the other listed GPOs off.',
		},
		{
			type: 'checkbox',
			id: 'gpi_select_enabled',
			label: 'Enable GPI select (gpi_selected_value variable)',
			width: 12,
			default: false,
			tooltip: 'Set a variable from the last closed GPI, e.g. to switch an ATEM Aux from GPI contacts',
		},
		{
			type: 'textinput',
			id: 'gpi_select_mapping',
			label: 'GPI select mapping (value=GPI, ...)',
			width: 12,
			isVisibleExpression: '$(options:gpi_select_enabled)',
			default: '',
			tooltip:
				'When a listed GPI closes, the gpi_selected_value variable is set to its value, e.g. "1=1, 2=2, 3=3" (value = ATEM input ID). Use it in a trigger to switch an ATEM Aux. Leave empty to disable.',
		},
	]
}
