// Value -> pin mappings edited as rows in the connection settings, used by
// "Tally from value" (value -> GPO) and GPI select (value -> GPI -> Aux).
// Companion config fields cannot form a real table, so each mapping is a fixed
// set of rows; a count field shows only the rows in use.
//
// BMD mode (on by default) shapes the rows for a Blackmagic ATEM: the value is
// a dropdown of ATEM sources and GPI select rows pick a target Aux. With BMD
// mode off the value is a plain text field and there is no Aux. The two value
// fields have their own config ids, so switching the mode keeps both.

/** Maximum number of rows per mapping (one per pin of the board) */
export const MAPPING_ROWS = 32

/** Rows shown by default (Input 1-4 -> pin 1-4) */
const DEFAULT_COUNT = 4

/** Aux outputs offered in GPI select rows (the largest ATEM models have 24) */
export const AUX_COUNT = 24
const AUX_CHOICES = Array.from({ length: AUX_COUNT }, (_, i) => ({ id: i + 1, label: `Aux ${i + 1}` }))

// ATEM video source IDs, offered as a starting point. allowCustom lets the user
// type any other value, so the mapping works with other modules too.
const SOURCE_CHOICES = [
	{ id: '0', label: 'Black (0)' },
	...Array.from({ length: 40 }, (_, i) => ({ id: String(i + 1), label: `Input ${i + 1}` })),
	{ id: '1000', label: 'Color Bars (1000)' },
	{ id: '2001', label: 'Color 1 (2001)' },
	{ id: '2002', label: 'Color 2 (2002)' },
	{ id: '3010', label: 'Media Player 1 (3010)' },
	{ id: '3020', label: 'Media Player 2 (3020)' },
	{ id: '10010', label: 'M/E 1 Program (10010)' },
	{ id: '10011', label: 'M/E 1 Preview (10011)' },
]

/** BMD mode is on unless switched off explicitly */
export function isBmdMode(config) {
	return config.bmd_mode ?? true
}

const BMD = '$(options:bmd_mode)'

const countId = (prefix) => `${prefix}_count`
const valueId = (prefix, row) => `${prefix}_value_${row}`
const textId = (prefix, row) => `${prefix}_text_${row}`
const pinId = (prefix, pinName, row) => `${prefix}_${pinName.toLowerCase()}_${row}`
const auxId = (prefix, row) => `${prefix}_aux_${row}`

/**
 * Config fields of one mapping: a row count, then MAPPING_ROWS rows of
 * value + pin, two rows per line. Row n defaults to "Input n -> pin n". The value
 * is an ATEM source dropdown in BMD mode and a text field otherwise. With `aux`,
 * each row also gets an Aux dropdown (default Aux 1, BMD mode only) and takes a
 * full line.
 * @param {string} prefix config id prefix, e.g. 'tally'
 * @param {'GPO'|'GPI'} pinName
 * @param {string} enabledId id of the checkbox that switches the feature on
 * @param {{ aux?: boolean }} [options]
 */
export function mappingConfigFields(prefix, pinName, enabledId, { aux = false } = {}) {
	const pinChoices = Array.from({ length: MAPPING_ROWS }, (_, i) => ({ id: i + 1, label: `${pinName} ${i + 1}` }))
	const fields = [
		{
			type: 'number',
			id: countId(prefix),
			label: 'Number of entries',
			width: 12,
			default: DEFAULT_COUNT,
			min: 0,
			max: MAPPING_ROWS,
			isVisibleExpression: `$(options:${enabledId})`,
			tooltip: `How many value → ${pinName} rows are used. Rows beyond this number are hidden and ignored.`,
		},
	]
	for (let row = 1; row <= MAPPING_ROWS; row++) {
		const isVisibleExpression = `$(options:${enabledId}) && $(options:${countId(prefix)}) >= ${row}`
		fields.push(
			{
				type: 'dropdown',
				id: valueId(prefix, row),
				label: `${row}. Source`,
				width: aux ? 6 : 4,
				default: String(row),
				choices: SOURCE_CHOICES,
				allowCustom: true,
				isVisibleExpression: `${isVisibleExpression} && ${BMD}`,
				tooltip: 'Pick an ATEM source or type any other value (compared as text, not case-sensitive)',
			},
			{
				type: 'textinput',
				id: textId(prefix, row),
				label: `${row}. Value`,
				width: aux ? 6 : 4,
				default: String(row),
				isVisibleExpression: `${isVisibleExpression} && !${BMD}`,
				tooltip: 'Any value, e.g. 5 or CAM1 (compared as text, not case-sensitive)',
			},
			{
				type: 'dropdown',
				id: pinId(prefix, pinName, row),
				label: `→ ${pinName}`,
				width: aux ? 3 : 2,
				default: row,
				choices: pinChoices,
				isVisibleExpression,
			},
		)
		if (aux) {
			fields.push({
				type: 'dropdown',
				id: auxId(prefix, row),
				label: '→ Aux',
				width: 3,
				default: 1,
				choices: AUX_CHOICES,
				isVisibleExpression: `${isVisibleExpression} && ${BMD}`,
			})
		}
	}
	return fields
}

/**
 * Reads the rows in use into [{ key, pin }] (pin 0-based), the same shape as
 * parseTallyMapping; with `aux` in BMD mode, as [{ key, pin, aux }] (aux
 * 1-based). The value comes from the field of the current mode. Empty
 * values and invalid pins are skipped, an unsaved or invalid Aux means Aux 1. A
 * count or row that was never saved uses the field defaults, matching what the
 * settings page shows.
 */
export function mappingFromConfig(config, prefix, pinName, { aux = false } = {}) {
	const bmd = isBmdMode(config)
	const rawCount = config[countId(prefix)] ?? DEFAULT_COUNT
	const count = Math.min(Math.max(Math.trunc(Number(rawCount)) || 0, 0), MAPPING_ROWS)
	const pairs = []
	for (let row = 1; row <= count; row++) {
		const key = String(config[bmd ? valueId(prefix, row) : textId(prefix, row)] ?? row).trim()
		const pinNum = Number(config[pinId(prefix, pinName, row)] ?? row)
		if (key === '' || !Number.isInteger(pinNum) || pinNum < 1 || pinNum > MAPPING_ROWS) continue
		const pair = { key, pin: pinNum - 1 }
		if (aux && bmd) {
			const auxNum = Number(config[auxId(prefix, row)] ?? 1)
			pair.aux = Number.isInteger(auxNum) && auxNum >= 1 && auxNum <= AUX_COUNT ? auxNum : 1
		}
		pairs.push(pair)
	}
	return pairs
}

/**
 * The inverse of mappingFromConfig: config values for the given pairs (at most
 * MAPPING_ROWS). The value goes into both value fields, so it survives a mode switch.
 */
export function mappingToConfig(pairs, prefix, pinName) {
	const rows = pairs.slice(0, MAPPING_ROWS)
	const values = { [countId(prefix)]: rows.length }
	rows.forEach(({ key, pin, aux }, i) => {
		values[valueId(prefix, i + 1)] = key
		values[textId(prefix, i + 1)] = key
		values[pinId(prefix, pinName, i + 1)] = pin + 1
		if (aux !== undefined) values[auxId(prefix, i + 1)] = aux
	})
	return values
}
