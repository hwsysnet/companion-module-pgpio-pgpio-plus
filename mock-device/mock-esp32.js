// Minimal mock of the PGPIO+ firmware, for testing the Companion
// module without real hardware. Implements the device side of the protocol
// described in PROTOCOL.md.
import { WebSocketServer } from 'ws'

const PORT = process.env.MOCK_PORT ? Number(process.env.MOCK_PORT) : 32032
const PATH = '/ws'
const GPI_COUNT = 32
const GPO_COUNT = 32

const gpi = new Array(GPI_COUNT).fill(0)
const gpo = new Array(GPO_COUNT).fill(0)

const wss = new WebSocketServer({ port: PORT, path: PATH })
console.log(`Mock PGPIO+ WebSocket server listening on ws://localhost:${PORT}${PATH}`)

let randomToggleTimer = null

wss.on('connection', (ws) => {
	console.log('Client connected')

	send(ws, {
		type: 'hello',
		device: 'pgpio-plus',
		fw_version: 'mock-1.0.0',
		gpi_count: GPI_COUNT,
		gpo_count: GPO_COUNT,
	})
	send(ws, { type: 'state', gpi, gpo })

	if (randomToggleTimer) clearInterval(randomToggleTimer)
	randomToggleTimer = setInterval(() => {
		const pin = Math.floor(Math.random() * GPI_COUNT)
		gpi[pin] = gpi[pin] ? 0 : 1
		console.log(`GPI ${pin + 1} -> ${gpi[pin]}`)
		send(ws, { type: 'gpi_change', pin, state: gpi[pin] })
	}, 4000)

	ws.on('message', (data) => {
		let msg
		try {
			msg = JSON.parse(data.toString())
		} catch (e) {
			console.warn('Invalid JSON from module:', data.toString())
			return
		}

		switch (msg.type) {
			case 'set_gpo':
				gpo[msg.pin] = msg.state ? 1 : 0
				console.log(`set_gpo pin=${msg.pin} state=${gpo[msg.pin]}`)
				send(ws, { type: 'gpo_ack', pin: msg.pin, state: gpo[msg.pin] })
				break

			case 'set_gpo_bulk':
				for (const { pin, state } of msg.pins || []) {
					gpo[pin] = state ? 1 : 0
				}
				console.log(`set_gpo_bulk -> ${JSON.stringify(gpo)}`)
				send(ws, { type: 'state', gpi, gpo })
				break

			case 'get_state':
				send(ws, { type: 'state', gpi, gpo })
				break

			case 'ping':
				send(ws, { type: 'pong' })
				break

			default:
				console.warn('Unknown message type from module:', msg.type)
		}
	})

	ws.on('close', () => {
		console.log('Client disconnected')
		if (randomToggleTimer) {
			clearInterval(randomToggleTimer)
			randomToggleTimer = null
		}
	})
})

function send(ws, obj) {
	ws.send(JSON.stringify(obj))
}
