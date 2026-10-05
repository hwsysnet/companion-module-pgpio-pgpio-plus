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
	]
}
