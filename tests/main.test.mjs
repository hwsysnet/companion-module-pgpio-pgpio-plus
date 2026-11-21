// Instance logic (GPI select, optional features) on an instance built with
// Object.create, so no InstanceContext / Companion is needed.
// Collected from the ad-hoc `node -e` checks of the 2026-10-14 session.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import Inst from '../main.js'

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
	const was = !!inst.config?.gpi_select_enabled
	inst.config = config
	inst._applyOptionalFeatures(was)
}

const selected = (inst) => inst.vars.filter((v) => 'gpi_selected_value' in v).map((v) => v.gpi_selected_value)

test('GPI select: closing a mapped GPI latches its value', () => {
	const inst = fakeInstance()
	configure(inst, { gpi_select_enabled: true, gpi_select_mapping: '1=1, 2=2, 3010=8, CAM4=4, bad' })
	assert.equal(inst.logs.filter((l) => l.level === 'warn').length, 1) // "bad"
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

test('optional features: action/variable defined only while enabled', () => {
	const inst = fakeInstance()

	// 1) old 1.0.0 config: both off
	configure(inst, { gpi_select_mapping: '1=1', tally_mapping: '1=1' })
	assert.ok(!('tally_from_value' in inst.actionDefs))
	assert.ok(!('gpi_selected_value' in inst.varDefs))
	inst.device.emit('gpi_change', 0, 1)
	assert.deepEqual(selected(inst), [])

	// 2) both on: variable reset once, then selects
	configure(inst, { tally_enabled: true, gpi_select_enabled: true, gpi_select_mapping: '1=1, 2=2' })
	assert.ok('tally_from_value' in inst.actionDefs)
	assert.ok('gpi_selected_value' in inst.varDefs)
	inst.device.emit('gpi_change', 1, 1)
	assert.deepEqual(selected(inst), ['', '2'])

	// 3) still on, other edit: no reset expected
	configure(inst, { tally_enabled: true, gpi_select_enabled: true, gpi_select_mapping: '1=1, 2=2' })
	assert.deepEqual(selected(inst), ['', '2'])

	// 4) both off again
	configure(inst, { gpi_select_mapping: '1=1, 2=2' })
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
