import { GPO_COUNT } from './device-connection.js'

function pinChoices(count) {
	const choices = []
	for (let i = 0; i < count; i++) {
		choices.push({ id: i, label: `GPO ${i + 1}` })
	}
	return choices
}

export function getActions(self) {
	return {
		set_gpo: {
			name: 'Set GPO',
			options: [
				{
					type: 'dropdown',
					id: 'pin',
					label: 'Output pin',
					default: 0,
					choices: pinChoices(GPO_COUNT),
				},
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Action',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'on', label: 'On' },
						{ id: 'off', label: 'Off' },
						{ id: 'momentary', label: 'Momentary (on while pressed)' },
					],
				},
			],
			callback: async (event) => {
				const pin = Number(event.options.pin)

				if (event.options.mode === 'momentary') {
					// same action placed on both the button's Press and Release
					// action lists: first call (press) arms + turns on, the
					// matching second call (release) disarms + turns off
					const wasArmed = self.momentaryPins.has(pin)
					self.log('debug', `momentary pin=${pin} actionId=${event.id} wasArmed=${wasArmed} -> ${wasArmed ? 'OFF' : 'ON'}`)
					if (wasArmed) {
						self.momentaryPins.delete(pin)
						self.device.setGpo(pin, 0)
					} else {
						self.momentaryPins.add(pin)
						self.device.setGpo(pin, 1)
					}
					return
				}

				let state
				if (event.options.mode === 'toggle') {
					state = self.device.gpo[pin] ? 0 : 1
				} else {
					state = event.options.mode === 'on' ? 1 : 0
				}
				self.device.setGpo(pin, state)
			},
		},

		pulse_gpo: {
			name: 'Pulse GPO',
			options: [
				{
					type: 'dropdown',
					id: 'pin',
					label: 'Output pin',
					default: 0,
					choices: pinChoices(GPO_COUNT),
				},
				{
					type: 'number',
					id: 'duration',
					label: 'Pulse duration (ms)',
					default: 500,
					min: 50,
					max: 60000,
				},
				{
					type: 'dropdown',
					id: 'active_state',
					label: 'Pulse to',
					default: 1,
					choices: [
						{ id: 1, label: 'On, then back to Off' },
						{ id: 0, label: 'Off, then back to On' },
					],
				},
			],
			callback: async (event) => {
				const pin = Number(event.options.pin)
				const activeState = Number(event.options.active_state)
				const restState = activeState ? 0 : 1
				self.device.setGpo(pin, activeState)
				setTimeout(() => {
					self.device.setGpo(pin, restState)
				}, Number(event.options.duration))
			},
		},

		set_all_gpo: {
			name: 'Set all GPO',
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Action',
					default: 'off',
					choices: [
						{ id: 'on', label: 'All On' },
						{ id: 'off', label: 'All Off' },
					],
				},
			],
			callback: async (event) => {
				self.device.setAllGpo(event.options.mode === 'on' ? 1 : 0)
			},
		},

		request_state: {
			name: 'Request full state from device',
			options: [],
			callback: async () => {
				self.device.requestState()
			},
		},
	}
}
