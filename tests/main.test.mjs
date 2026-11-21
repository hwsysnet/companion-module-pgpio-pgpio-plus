// Instance logic (GPI select, optional features) on an instance built with
// Object.create, so no InstanceContext / Companion is needed.
// Collected from the ad-hoc `node -e` checks of the 2026-10-14 session.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import Inst from '../main.js'
import { parseTallyMapping } from '../actions.js'
import { mappingToConfig } from '../mapping.js'

function fakeInstance() {
	const inst = Object.create(Inst.prototype)
	inst.logs = []
	inst.vars = []
	inst.actionDefs = null
	inst.varDefs = null
	inst.log = (level, msg) => inst.logs.push({ level, msg })
	inst.setActionDefinitions = (a) => (inst.actionDefs = a)
	inst.setVariableDefinitions = (v) => (inst.varDefs = v)
	inst.setVariableValues = (v) => inst.vars.push(v)
	inst.checkFeedbacks = () => {}
	inst.updateStatus = () => {}
	inst.device = new EventEmitter()
	inst.device.gpi = Array(32).fill(0)
	inst.device.gpo = Array(32).fill(0)
	inst._bindDeviceEvents()
	return inst
}

function configure(inst, config) {
	const previous = inst.config ?? {}
	inst.config = config
	inst._applyOptionalFeatures(previous)
}

// GPI select rows as the settings page saves them, written as "value=GPI" text for brevity
const gpiRows = (text) => mappingToConfig(parseTallyMapping(text, 32).pairs, 'gpi_select', 'GPI')
const lastValues = (inst, name) => inst.vars.filter((v) => name in v).map((v) => v[name])

const selected = (inst) => inst.vars.filter((v) => 'gpi_selected_value' in v).map((v) => v.gpi_selected_value)

test('GPI select: closing a mapped GPI latches its value', () => {
	const inst = fakeInstance()
	configure(inst, { gpi_select_enabled: true, ...gpiRows('1=1, 2=2, 3010=8, CAM4=4') })
	inst.vars.length = 0

	for (const [pin, st] of [
		[1, 1], // GPI 2 close -> "2"
		[1, 0], // GPI 2 open  -> no change
		[7, 1], // GPI 8 close -> "3010"
		[3, 1], // GPI 4 close -> "CAM4"
		[4, 1], // GPI 5 close -> unmapped, no change
		[0, 1], // GPI 1 close -> "1"
	])
		inst.device.emit('gpi_change', pin, st)

	assert.deepEqual(selected(inst), ['2', '3010', 'CAM4', '1'])
})

test('GPI select: Aux of the row and a counter that rises on every mapped close', () => {
	const inst = fakeInstance()
	configure(inst, {
		gpi_select_enabled: true,
		...mappingToConfig(
			[
				{ key: '2', pin: 0, aux: 1 },
				{ key: '2', pin: 4, aux: 2 },
			],
			'gpi_select',
			'GPI',
		),
	})
	assert.ok('gpi_selected_aux' in inst.varDefs)
	assert.ok('gpi_select_seq' in inst.varDefs)
	assert.deepEqual(inst.vars.slice(-2), [{ gpi_selected_value: '', gpi_select_seq: 0 }, { gpi_selected_aux: '' }])
	inst.vars.length = 0

	for (const [pin, st] of [
		[0, 1], // GPI 1: source 2 -> Aux 1
		[0, 0], // open: nothing
		[0, 1], // GPI 1 again: same values, counter still rises
		[4, 1], // GPI 5: same source 2 -> Aux 2
		[9, 1], // unmapped: nothing
	])
		inst.device.emit('gpi_change', pin, st)

	assert.deepEqual(lastValues(inst, 'gpi_selected_value'), ['2', '2', '2'])
	assert.deepEqual(lastValues(inst, 'gpi_selected_aux'), [1, 1, 2])
	assert.deepEqual(lastValues(inst, 'gpi_select_seq'), [1, 2, 3])
})

test('GPI select without BMD mode: text values, no Aux variable', () => {
	const inst = fakeInstance()
	configure(inst, {
		gpi_select_enabled: true,
		bmd_mode: false,
		gpi_select_count: 2,
		gpi_select_text_1: 'CAM1',
		gpi_select_gpi_1: 1,
		gpi_select_aux_1: 3, // ignored without BMD mode
		gpi_select_value_2: '3010', // the BMD field, ignored
		gpi_select_text_2: 'CAM2',
		gpi_select_gpi_2: 2,
	})
	assert.ok(!('gpi_selected_aux' in inst.varDefs))
	inst.vars.length = 0
	inst.device.emit('gpi_change', 0, 1)
	inst.device.emit('gpi_change', 1, 1)
	assert.deepEqual(selected(inst), ['CAM1', 'CAM2'])
	assert.deepEqual(lastValues(inst, 'gpi_selected_aux'), [])

	// BMD mode switched on: the Aux variable appears, cleared
	configure(inst, { ...inst.config, bmd_mode: true })
	assert.ok('gpi_selected_aux' in inst.varDefs)
	assert.deepEqual(lastValues(inst, 'gpi_selected_aux'), [''])
})

test('optional features: action/variable defined only while enabled', () => {
	const inst = fakeInstance()

	// 1) old 1.0.0 config: both off
	configure(inst, { ...gpiRows('1=1'), tally_count: 1 })
	assert.ok(!('tally_from_value' in inst.actionDefs))
	assert.ok(!('gpi_selected_value' in inst.varDefs))
	inst.device.emit('gpi_change', 0, 1)
	assert.deepEqual(selected(inst), [])

	// 2) both on: variable reset once, then selects
	configure(inst, { tally_enabled: true, gpi_select_enabled: true, ...gpiRows('1=1, 2=2') })
	assert.ok('tally_from_value' in inst.actionDefs)
	assert.ok('gpi_selected_value' in inst.varDefs)
	inst.device.emit('gpi_change', 1, 1)
	assert.deepEqual(selected(inst), ['', '2'])

	// 3) still on, other edit: no reset expected
	configure(inst, { tally_enabled: true, gpi_select_enabled: true, ...gpiRows('1=1, 2=2') })
	assert.deepEqual(selected(inst), ['', '2'])

	// 4) both off again
	configure(inst, { ...gpiRows('1=1, 2=2') })
	assert.ok(!('tally_from_value' in inst.actionDefs))
	assert.ok(!('gpi_selected_value' in inst.varDefs))
	inst.device.emit('gpi_change', 0, 1)
	assert.deepEqual(selected(inst), ['', '2'])
})

test('no host and no discovered device: BadConfig, no connection attempt', () => {
	const inst = fakeInstance()
	const statuses = []
	inst.updateStatus = (s, msg) => statuses.push([s, msg])
	let started = false
	inst.device.configure = () => {}
	inst.device.start = () => (started = true)

	inst.config = { host: '', port: 32032 }
	inst._startDevice()
	assert.equal(statuses.at(-1)[0], 'bad_config')
	assert.equal(started, false)

	inst.config = { bonjour_host: '10.0.0.5:32032' }
	inst._startDevice()
	assert.equal(statuses.at(-1)[0], 'connecting')
	assert.equal(started, true)
})

test('configUpdated clears device_status, even when the new config has no address', async () => {
	const inst = fakeInstance()
	const checked = []
	inst.checkFeedbacks = (...ids) => checked.push(...ids)
	inst.device.stop = () => {}
	inst.config = { host: '10.0.0.5', port: 32032 }
	inst.device.emit('connect')
	assert.deepEqual(inst.vars.at(-1), { device_status: true })

	await inst.configUpdated({ host: '', port: 32032 })
	assert.ok(inst.vars.some((v) => v.device_status === false))
	assert.ok(checked.includes('device_status'))
})
