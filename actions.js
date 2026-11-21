import { GPO_COUNT } from './device-connection.js'

function pinChoices(count) {
	const choices = []
	for (let i = 0; i < count; i++) {
		choices.push({ id: i, label: `GPO ${i + 1}` })
	}
	return choices
}

/**
 * Parses "1=1, 2=2, cam3=3" into [{ key: '1', pin: 0 }, ...] (pin is 0-based).
 * Pairs may be separated by commas, semicolons or newlines.
 * Shared by the "Tally from value" action (value=GPO) and the GPI select config (value=GPI).
 */
export function parseTallyMapping(text, pinCount = GPO_COUNT) {
	const pairs = []
	const errors = []
	for (const entry of text.split(/[,;\n]/)) {
		if (entry.trim() === '') continue
		const sep = entry.lastIndexOf('=')
		const key = entry.slice(0, sep).trim()
		const pinNum = Number(entry.slice(sep + 1).trim())
		if (sep === -1 || key === '' || !Number.isInteger(pinNum) || pinNum < 1 || pinNum > pinCount) {
			errors.push(`invalid mapping entry "${entry.trim()}" (expected value=pin, pin 1-${pinCount})`)
			continue
		}
		pairs.push({ key, pin: pinNum - 1 })
	}
	return { pairs, errors }
}

export function getActions(self) {
	const actions = {
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
					self.log(
						'debug',
						`momentary pin=${pin} actionId=${event.id} wasArmed=${wasArmed} -> ${wasArmed ? 'OFF' : 'ON'}`,
					)
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
				// a new pulse on the same pin restarts the timer instead of being cut short by the old one
				clearTimeout(self.pulseTimers.get(pin))
				self.pulseTimers.delete(pin)
				// if the pulse could not start (not connected), do not send the delayed rest state either
				if (!self.device.setGpo(pin, activeState)) return
				self.pulseTimers.set(
					pin,
					setTimeout(() => {
						self.pulseTimers.delete(pin)
						self.device.setGpo(pin, restState)
					}, Number(event.options.duration)),
				)
			},
		},

		tally_from_value: {
			name: 'Tally from value',
			description:
				'Switch on the GPO(s) mapped to the current value and switch off every other GPO in the mapping (e.g. ATEM Aux source → tally lamps)',
			options: [
				{
					type: 'textinput',
					id: 'value',
					label: 'Value',
					default: '',
					useVariables: true,
					tooltip: 'Usually a variable of another module, e.g. $(atem:aux1_input_id)',
				},
				{
					type: 'dropdown',
					id: 'mapping_source',
					label: 'Mapping',
					default: 'config',
					disableAutoExpression: true,
					choices: [
						{ id: 'config', label: 'From connection settings (Tally mapping)' },
						{ id: 'custom', label: 'Custom (below)' },
					],
				},
				{
					type: 'textinput',
					id: 'mapping',
					label: 'Custom mapping (value=GPO, ...)',
					default: '1=1, 2=2, 3=3, 4=4',
					isVisibleExpression: "$(options:mapping_source) == 'custom'",
					tooltip:
						'Comma separated value=GPO pairs, e.g. "1=1, 2=2, 3010=8". Values are matched as text (case-insensitive). Several values may share a GPO.',
				},
			],
			callback: async (event) => {
				const value = String(event.options.value ?? '')
					.trim()
					.toLowerCase()
				const mapping = event.options.mapping_source === 'custom' ? event.options.mapping : self.config.tally_mapping
				const { pairs, errors } = parseTallyMapping(String(mapping ?? ''))
				for (const err of errors) self.log('warn', `Tally from value: ${err}`)
				if (pairs.length === 0) {
					self.log('warn', 'Tally from value: no mapping set (connection settings "Tally mapping" or custom mapping)')
					return
				}

				// every GPO in the mapping belongs to the group: one is lit, the rest go off,
				// sent as one bulk message so two tallies are never on at the same time
				const states = new Map()
				for (const { key, pin } of pairs) {
					states.set(pin, (states.get(pin) ?? 0) || (key.toLowerCase() === value ? 1 : 0))
				}
				self.log('debug', `tally value="${value}" -> on: [${[...states].filter(([, s]) => s).map(([p]) => p + 1)}]`)
				self.device.setGpoBulk([...states].map(([pin, state]) => ({ pin, state })))
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

	// optional feature, switched on in the connection settings
	if (!self.config.tally_enabled) delete actions.tally_from_value

	return actions
}
