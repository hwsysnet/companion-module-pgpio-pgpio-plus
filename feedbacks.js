import { combineRgb } from '@companion-module/base'
import { GPI_COUNT, GPO_COUNT } from './device-connection.js'

function pinChoices(count, prefix) {
	const choices = []
	for (let i = 0; i < count; i++) {
		choices.push({ id: i, label: `${prefix} ${i + 1}` })
	}
	return choices
}

// "ON" here means closed contact / energized relay (state 1 / true) — see
// PROTOCOL.md "Logikai polaritás" (logical polarity). Open contact / de-energized relay is "OFF".
export function getFeedbacks(self) {
	return {
		device_status: {
			type: 'boolean',
			name: 'Device connection status',
			description: 'True while the PGPIO+ device is connected and reachable',
			defaultStyle: {
				bgcolor: combineRgb(0, 204, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: () => self.device.isConnected(),
		},

		gpi_state: {
			type: 'boolean',
			name: 'GPI state',
			description: 'Change style based on a GPI input state',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					type: 'dropdown',
					id: 'pin',
					label: 'Input pin',
					default: 0,
					choices: pinChoices(GPI_COUNT, 'GPI'),
				},
				{
					type: 'checkbox',
					id: 'state',
					label: 'When ON',
					default: true,
				},
			],
			callback: (feedback) => {
				const pin = Number(feedback.options.pin)
				return Boolean(self.device.gpi[pin]) === feedback.options.state
			},
		},

		gpo_state: {
			type: 'boolean',
			name: 'GPO state',
			description: 'Change style based on a GPO output state',
			defaultStyle: {
				bgcolor: combineRgb(0, 204, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					type: 'dropdown',
					id: 'pin',
					label: 'Output pin',
					default: 0,
					choices: pinChoices(GPO_COUNT, 'GPO'),
				},
				{
					type: 'checkbox',
					id: 'state',
					label: 'When ON',
					default: true,
				},
			],
			callback: (feedback) => {
				const pin = Number(feedback.options.pin)
				return Boolean(self.device.gpo[pin]) === feedback.options.state
			},
		},
	}
}
