// DeviceConnection against a real in-process WebSocket server playing the device.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { WebSocketServer } from 'ws'
import { DeviceConnection } from '../device-connection.js'

const zeros = () => Array(32).fill(0)

async function setup(t, { gpiCount = 32 } = {}) {
	const wss = new WebSocketServer({ port: 0, path: '/ws' })
	await once(wss, 'listening')
	const received = []
	wss.on('connection', (ws) => {
		ws.on('message', (data) => {
			const msg = JSON.parse(data.toString())
			received.push(msg)
			if (msg.type === 'get_state') ws.send(JSON.stringify({ type: 'state', gpi: zeros(), gpo: zeros() }))
		})
		ws.send(JSON.stringify({ type: 'hello', device: 'test', gpi_count: gpiCount, gpo_count: 32 }))
	})

	const logs = []
	const dev = new DeviceConnection((level, msg) => logs.push({ level, msg }))
	dev.on('error', () => {})
	dev.configure('127.0.0.1', wss.address().port, '/ws', 1000)
	t.after(() => {
		dev.stop()
		for (const c of wss.clients) c.terminate()
		wss.close()
	})
	return { wss, dev, received, logs }
}

const waitFor = async (cond) => {
	for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 10))
	assert.ok(cond())
}

test('hello -> connect, then requests and applies the full state', async (t) => {
	const { dev, received } = await setup(t)
	const connected = once(dev, 'connect')
	const state = once(dev, 'state')
	dev.start()
	await connected
	await state
	assert.ok(dev.isConnected())
	assert.ok(received.some((m) => m.type === 'get_state'))
})

test('gpi_change updates the cache and emits only on a real change', async (t) => {
	const { wss, dev } = await setup(t)
	dev.start()
	await once(dev, 'state')
	const events = []
	dev.on('gpi_change', (pin, state) => events.push([pin, state]))
	const [client] = wss.clients
	for (const state of [1, 1, 0]) client.send(JSON.stringify({ type: 'gpi_change', pin: 4, state }))
	await waitFor(() => events.length === 2)
	assert.deepEqual(events, [
		[4, 1],
		[4, 0],
	])
})

test('setGpo sends the command and updates the cache while connected', async (t) => {
	const { dev, received } = await setup(t)
	dev.start()
	await once(dev, 'state')
	assert.equal(dev.setGpo(10, 1), true)
	assert.equal(dev.gpo[10], 1)
	await waitFor(() => received.some((m) => m.type === 'set_gpo'))
	assert.deepEqual(
		received.find((m) => m.type === 'set_gpo'),
		{ type: 'set_gpo', pin: 10, state: 1 },
	)
})

test('setGpo / setGpoBulk while disconnected leave the cache untouched', () => {
	const logs = []
	const dev = new DeviceConnection((level, msg) => logs.push({ level, msg }))
	assert.equal(dev.setGpo(3, 1), false)
	assert.equal(dev.setGpoBulk([{ pin: 1, state: 1 }]), false)
	assert.deepEqual(dev.gpo, zeros())
	assert.equal(logs.filter((l) => l.level === 'warn').length, 2)
})

test('a device with an unexpected pin count is logged as a warning', async (t) => {
	const { dev, logs } = await setup(t, { gpiCount: 16 })
	dev.start()
	await once(dev, 'connect')
	assert.ok(logs.some((l) => l.level === 'warn' && l.msg.includes('16 GPI')))
})
