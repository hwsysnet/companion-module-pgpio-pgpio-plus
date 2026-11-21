// Action callbacks tested with a fake `self`, no Companion needed.
// Collected from the ad-hoc `node -e` checks of the 2026-10-14 session.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getActions, parseTallyMapping } from '../actions.js'

function fakeSelf(config = {}) {
	const self = {
		config,
		sent: [],
		single: [],
		logs: [],
		device: {
			gpo: Array(32).fill(0),
			setGpo: (pin, state) => {
				if (self.disconnected) return false
				self.single.push({ pin, state })
				return true
			},
			setGpoBulk: (p) => self.sent.push(p),
		},
		momentaryPins: new Set(),
		pulseTimers: new Map(),
		log: (level, msg) => self.logs.push({ level, msg }),
	}
	return self
}

async function tally(value, mapping) {
	const self = fakeSelf({ tally_enabled: true })
	await getActions(self).tally_from_value.callback({ options: { value, mapping_source: 'custom', mapping } })
	return self
}

test('tally: matching value lights its GPO, the rest of the group goes off', async () => {
	const self = await tally('2', '1=1, 2=2, 3=3')
	assert.deepEqual(self.sent, [
		[
			{ pin: 0, state: 0 },
			{ pin: 1, state: 1 },
			{ pin: 2, state: 0 },
		],
	])
})

test('tally: numeric value and ; / newline separators', async () => {
	const self = await tally(3, '1=1; 2=2\n3=3')
	assert.deepEqual(self.sent, [
		[
			{ pin: 0, state: 0 },
			{ pin: 1, state: 0 },
			{ pin: 2, state: 1 },
		],
	])
})

test('tally: unmapped value (e.g. color bars) switches all off', async () => {
	const self = await tally('1000', '1=1, 2=2')
	assert.deepEqual(self.sent, [
		[
			{ pin: 0, state: 0 },
			{ pin: 1, state: 0 },
		],
	])
})

test('tally: case-insensitive text values', async () => {
	const self = await tally('CAM2', 'cam1=5, cam2=6')
	assert.deepEqual(self.sent, [
		[
			{ pin: 4, state: 0 },
			{ pin: 5, state: 1 },
		],
	])
})

test('tally: several values may share a GPO', async () => {
	const self = await tally('1', '1=1, 4=1, 2=2')
	assert.deepEqual(self.sent, [
		[
			{ pin: 0, state: 1 },
			{ pin: 1, state: 0 },
		],
	])
})

test('tally: invalid entries are skipped with a warning', async () => {
	const self = await tally('1', '1=1, x, 2=40, =3')
	assert.deepEqual(self.sent, [[{ pin: 0, state: 1 }]])
	assert.equal(self.logs.filter((l) => l.level === 'warn').length, 3)
})

test('tally: empty mapping sends nothing', async () => {
	const self = await tally('1', '')
	assert.deepEqual(self.sent, [])
})

test('tally: mapping_source=config uses the connection settings', async () => {
	const self = fakeSelf({ tally_enabled: true, tally_mapping: '1=3, 2=4' })
	await getActions(self).tally_from_value.callback({ options: { value: '2', mapping_source: 'config' } })
	assert.deepEqual(self.sent, [
		[
			{ pin: 2, state: 0 },
			{ pin: 3, state: 1 },
		],
	])
})

test('tally action only exists while tally_enabled', () => {
	assert.ok(!('tally_from_value' in getActions(fakeSelf({}))))
	assert.ok('tally_from_value' in getActions(fakeSelf({ tally_enabled: true })))
})

test('parseTallyMapping honours the pin count', () => {
	const { pairs, errors } = parseTallyMapping('a=1, b=32, c=33', 32)
	assert.deepEqual(pairs, [
		{ key: 'a', pin: 0 },
		{ key: 'b', pin: 31 },
	])
	assert.equal(errors.length, 1)
})

test('momentary: press arms + on, release disarms + off', async () => {
	const self = fakeSelf({})
	const setGpo = getActions(self).set_gpo
	const ev = { id: 'a1', options: { pin: 4, mode: 'momentary' } }
	await setGpo.callback(ev) // Press
	assert.ok(self.momentaryPins.has(4))
	await setGpo.callback(ev) // Release
	assert.ok(!self.momentaryPins.has(4))
	assert.deepEqual(self.single, [
		{ pin: 4, state: 1 },
		{ pin: 4, state: 0 },
	])
})

test('pulse: a second pulse on the same pin restarts the timer', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] })
	const self = fakeSelf({})
	const pulse = getActions(self).pulse_gpo
	const ev = { options: { pin: 2, duration: 500, active_state: 1 } }
	await pulse.callback(ev)
	t.mock.timers.tick(300)
	await pulse.callback(ev) // retrigger before the first pulse ends
	t.mock.timers.tick(300) // the first timer would have fired here
	assert.deepEqual(self.single, [
		{ pin: 2, state: 1 },
		{ pin: 2, state: 1 },
	])
	t.mock.timers.tick(200)
	assert.deepEqual(self.single.at(-1), { pin: 2, state: 0 })
	assert.equal(self.pulseTimers.size, 0)
})

test('pulse: not connected -> no delayed rest-state command later', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] })
	const self = fakeSelf({})
	self.disconnected = true
	await getActions(self).pulse_gpo.callback({ options: { pin: 1, duration: 500, active_state: 0 } })
	self.disconnected = false // connection comes back during the would-be pulse
	t.mock.timers.tick(1000)
	assert.deepEqual(self.single, [])
	assert.equal(self.pulseTimers.size, 0)
})
