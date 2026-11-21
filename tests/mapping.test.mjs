// Row based value -> pin mappings in the connection settings, and the upgrade
// script that converts the old "1=1, 2=2" text fields into rows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mappingConfigFields, mappingFromConfig, mappingToConfig, MAPPING_ROWS } from '../mapping.js'
import UpgradeScripts from '../upgrades.js'

test('mapping fields: count + value/pin dropdown per row, rows hidden beyond the count', () => {
	const fields = mappingConfigFields('tally', 'GPO', 'tally_enabled')
	assert.equal(fields.length, 1 + 3 * MAPPING_ROWS)
	assert.equal(fields[0].id, 'tally_count')
	const [value3, text3, pin3] = fields.slice(7, 10)
	const row3 = '$(options:tally_enabled) && $(options:tally_count) >= 3'
	assert.equal(value3.id, 'tally_value_3')
	assert.equal(value3.allowCustom, true)
	assert.equal(value3.default, '3')
	assert.equal(value3.isVisibleExpression, `${row3} && $(options:bmd_mode)`)
	assert.equal(text3.id, 'tally_text_3')
	assert.equal(text3.type, 'textinput')
	assert.equal(text3.isVisibleExpression, `${row3} && !$(options:bmd_mode)`)
	assert.equal(pin3.id, 'tally_gpo_3')
	assert.equal(pin3.default, 3)
	assert.equal(pin3.isVisibleExpression, row3)
})

test('mappingFromConfig: only the rows in use, pins 0-based, empty values skipped', () => {
	const config = {
		gpi_select_count: 3,
		gpi_select_value_1: '3010',
		gpi_select_gpi_1: 8,
		gpi_select_value_2: '  ',
		gpi_select_gpi_2: 2,
		gpi_select_value_3: 'CAM4',
		gpi_select_gpi_3: 4,
		gpi_select_value_4: '9', // beyond the count
		gpi_select_gpi_4: 9,
	}
	assert.deepEqual(mappingFromConfig(config, 'gpi_select', 'GPI'), [
		{ key: '3010', pin: 7 },
		{ key: 'CAM4', pin: 3 },
	])
})

test('mappingFromConfig: unsaved count and rows use the defaults, a bad count means none', () => {
	assert.deepEqual(mappingFromConfig({ tally_count: 2 }, 'tally', 'GPO'), [
		{ key: '1', pin: 0 },
		{ key: '2', pin: 1 },
	])
	assert.equal(mappingFromConfig({}, 'tally', 'GPO').length, 4)
	assert.deepEqual(mappingFromConfig({ tally_count: 'x' }, 'tally', 'GPO'), [])
	assert.deepEqual(mappingFromConfig({ tally_count: -5 }, 'tally', 'GPO'), [])
	assert.equal(mappingFromConfig({ tally_count: 99 }, 'tally', 'GPO').length, MAPPING_ROWS)
})

test('mappingToConfig round-trips through mappingFromConfig', () => {
	const pairs = [
		{ key: '1', pin: 4 },
		{ key: 'cam2', pin: 31 },
	]
	const config = mappingToConfig(pairs, 'tally', 'GPO')
	assert.deepEqual(config, {
		tally_count: 2,
		tally_value_1: '1',
		tally_text_1: '1',
		tally_gpo_1: 5,
		tally_value_2: 'cam2',
		tally_text_2: 'cam2',
		tally_gpo_2: 32,
	})
	assert.deepEqual(mappingFromConfig(config, 'tally', 'GPO'), pairs)
	assert.deepEqual(mappingFromConfig({ ...config, bmd_mode: false }, 'tally', 'GPO'), pairs)
})

test('without BMD mode the value comes from the text field', () => {
	const config = { bmd_mode: false, tally_count: 1, tally_value_1: '3010', tally_text_1: 'CAM1', tally_gpo_1: 2 }
	assert.deepEqual(mappingFromConfig(config, 'tally', 'GPO'), [{ key: 'CAM1', pin: 1 }])
	assert.deepEqual(mappingFromConfig({ ...config, bmd_mode: true }, 'tally', 'GPO'), [{ key: '3010', pin: 1 }])
})

test('GPI select rows carry an Aux dropdown (1-24), tally rows do not', () => {
	const gpi = mappingConfigFields('gpi_select', 'GPI', 'gpi_select_enabled', { aux: true })
	assert.equal(gpi.length, 1 + 4 * MAPPING_ROWS)
	const aux2 = gpi.find((f) => f.id === 'gpi_select_aux_2')
	assert.equal(aux2.default, 1)
	assert.ok(aux2.isVisibleExpression.endsWith('&& $(options:bmd_mode)'))
	assert.equal(aux2.choices.length, 24)
	assert.deepEqual(aux2.choices[23], { id: 24, label: 'Aux 24' })
	assert.ok(!mappingConfigFields('tally', 'GPO', 'tally_enabled').some((f) => f.id.startsWith('tally_aux_')))
})

test('mappingFromConfig with aux: Aux per row, unsaved or invalid Aux means Aux 1', () => {
	const config = {
		gpi_select_count: 3,
		gpi_select_value_1: '1',
		gpi_select_gpi_1: 1,
		gpi_select_aux_1: 2,
		gpi_select_value_2: '2',
		gpi_select_gpi_2: 2,
		gpi_select_value_3: '3',
		gpi_select_gpi_3: 3,
		gpi_select_aux_3: 99,
	}
	assert.deepEqual(mappingFromConfig(config, 'gpi_select', 'GPI', { aux: true }), [
		{ key: '1', pin: 0, aux: 2 },
		{ key: '2', pin: 1, aux: 1 },
		{ key: '3', pin: 2, aux: 1 },
	])
	// without the option, or without BMD mode, the Aux is not read at all
	assert.deepEqual(mappingFromConfig(config, 'gpi_select', 'GPI')[0], { key: '1', pin: 0 })
	assert.deepEqual(mappingFromConfig({ ...config, bmd_mode: false }, 'gpi_select', 'GPI', { aux: true })[0], {
		key: '1',
		pin: 0,
	})
})

test('mappingToConfig writes the Aux when the pair has one', () => {
	assert.deepEqual(mappingToConfig([{ key: '5', pin: 0, aux: 3 }], 'gpi_select', 'GPI'), {
		gpi_select_count: 1,
		gpi_select_value_1: '5',
		gpi_select_text_1: '5',
		gpi_select_gpi_1: 1,
		gpi_select_aux_1: 3,
	})
})

function upgrade(config) {
	let result = null
	for (const script of UpgradeScripts) {
		result = script({ currentConfig: config }, { config, secrets: null, actions: [], feedbacks: [] })
		if (result.updatedConfig) config = result.updatedConfig
	}
	return result
}

test('upgrade: text mappings become rows, other settings are kept', () => {
	const result = upgrade({
		host: '10.0.0.5',
		tally_enabled: true,
		tally_mapping: '1=1, 2=2, 3010=8, bad',
		gpi_select_enabled: false,
		gpi_select_mapping: '',
	})
	assert.deepEqual(result.updatedConfig, {
		host: '10.0.0.5',
		tally_enabled: true,
		gpi_select_enabled: false,
		tally_count: 3,
		tally_value_1: '1',
		tally_text_1: '1',
		tally_gpo_1: 1,
		tally_value_2: '2',
		tally_text_2: '2',
		tally_gpo_2: 2,
		tally_value_3: '3010',
		tally_text_3: '3010',
		tally_gpo_3: 8,
		gpi_select_count: 0,
		bmd_mode: true,
	})
	assert.deepEqual(result.updatedActions, [])
	assert.deepEqual(result.updatedFeedbacks, [])
})

test('upgrade: BMD mode is added as on, an existing choice is kept', () => {
	assert.deepEqual(upgrade({ host: '10.0.0.5', tally_count: 2 }).updatedConfig, {
		host: '10.0.0.5',
		tally_count: 2,
		bmd_mode: true,
	})
	assert.equal(upgrade({ bmd_mode: false }).updatedConfig, null)
	assert.equal(upgrade(null).updatedConfig, null)
})
