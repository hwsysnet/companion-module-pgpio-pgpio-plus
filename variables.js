import { GPI_COUNT, GPO_COUNT } from './device-connection.js'
import { isBmdMode } from './mapping.js'

// Polarity contract with the firmware (see PROTOCOL.md "Logical polarity"):
// open contact / de-energized relay = 0 (false), closed contact / energized relay = 1 (true).
export function toBool(value) {
	return !!value
}

export function getVariableDefinitions(config) {
	const vars = {}

	vars.device_status = { name: 'Device connection status (boolean)' }
	if (config.gpi_select_enabled) {
		vars.gpi_selected_value = { name: 'GPI select: source value of the last closed mapped GPI' }
		if (isBmdMode(config)) {
			vars.gpi_selected_aux = { name: 'GPI select: Aux number (1-based) of the last closed mapped GPI' }
		}
		vars.gpi_select_seq = { name: 'GPI select: counter, rises on every mapped GPI close (watch it in a trigger)' }
	}

	for (let i = 0; i < GPI_COUNT; i++) {
		vars[`gpi_${i + 1}`] = { name: `GPI ${i + 1} state (boolean)` }
	}
	for (let i = 0; i < GPO_COUNT; i++) {
		vars[`gpo_${i + 1}`] = { name: `GPO ${i + 1} state (boolean)` }
	}
	return vars
}

export function gpiVariableValues(gpiArray) {
	const values = {}
	gpiArray.forEach((state, i) => {
		values[`gpi_${i + 1}`] = toBool(state)
	})
	return values
}

export function gpoVariableValues(gpoArray) {
	const values = {}
	gpoArray.forEach((state, i) => {
		values[`gpo_${i + 1}`] = toBool(state)
	})
	return values
}
