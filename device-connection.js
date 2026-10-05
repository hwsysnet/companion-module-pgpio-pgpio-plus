import WebSocket from 'ws'
import { EventEmitter } from 'events'

export const GPI_COUNT = 32
export const GPO_COUNT = 32

const PING_INTERVAL_MS = 10000
const CONNECTION_TIMEOUT_MS = 15000

/**
 * Wraps the WebSocket connection to the PGPIO+ device and
 * implements the protocol described in PROTOCOL.md.
 *
 * Emits:
 *  - 'connect'            when the WS connection is open and 'hello' was received
 *  - 'disconnect'         when the connection is lost / closed
 *  - 'gpi_change' (pin, state)
 *  - 'gpo_change' (pin, state)   fired for both gpo_ack and optimistic local updates
 *  - 'state' (gpi[], gpo[])      full snapshot received
 *  - 'error' (err)
 */
export class DeviceConnection extends EventEmitter {
	constructor(log) {
		super()
		this.log = log || (() => {})
		this.ws = null
		this.reconnectTimer = null
		this.pingTimer = null
		this.lastMessageAt = 0
		this.watchdogTimer = null
		this.destroyed = false

		this.gpi = new Array(GPI_COUNT).fill(0)
		this.gpo = new Array(GPO_COUNT).fill(0)

		this.host = null
		this.port = null
		this.path = '/ws'
		this.reconnectIntervalMs = 5000
	}

	configure(host, port, path, reconnectIntervalMs) {
		this.host = host
		this.port = port
		this.path = path && path.length > 0 ? path : '/ws'
		this.reconnectIntervalMs = reconnectIntervalMs || 5000
	}

	start() {
		this.destroyed = false
		this._connect()
	}

	stop() {
		this.destroyed = true
		this._clearTimers()
		if (this.ws) {
			const ws = this.ws
			this.ws = null
			ws.removeAllListeners()
			// terminate() on a socket that hasn't finished connecting emits an
			// 'error' event; swallow it since we just removed all real listeners
			ws.on('error', () => {})
			try {
				ws.terminate()
			} catch (e) {
				// ignore
			}
		}
	}

	isConnected() {
		return !!this.ws && this.ws.readyState === WebSocket.OPEN
	}

	_connect() {
		if (this.destroyed || !this.host || !this.port) return

		const url = `ws://${this.host}:${this.port}${this.path}`
		this.log('debug', `Connecting to ${url}`)

		let ws
		try {
			ws = new WebSocket(url)
		} catch (e) {
			this.log('error', `Failed to create WebSocket: ${e.message}`)
			this._scheduleReconnect()
			return
		}
		this.ws = ws

		ws.on('open', () => {
			this.log('debug', 'WebSocket connection opened')
			this.lastMessageAt = Date.now()
			this._startPing()
			this._startWatchdog()
		})

		ws.on('message', (data) => {
			this.lastMessageAt = Date.now()
			this._handleMessage(data)
		})

		ws.on('close', () => {
			this.log('debug', 'WebSocket connection closed')
			this._clearTimers()
			this.emit('disconnect')
			this._scheduleReconnect()
		})

		ws.on('error', (err) => {
			this.log('warn', `WebSocket error: ${err.message}`)
			this.emit('error', err)
		})
	}

	_scheduleReconnect() {
		if (this.destroyed) return
		if (this.reconnectTimer) return
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			this._connect()
		}, this.reconnectIntervalMs)
	}

	_startPing() {
		this._stopPing()
		this.pingTimer = setInterval(() => {
			this._send({ type: 'ping' })
		}, PING_INTERVAL_MS)
	}

	_stopPing() {
		if (this.pingTimer) {
			clearInterval(this.pingTimer)
			this.pingTimer = null
		}
	}

	_startWatchdog() {
		this._stopWatchdog()
		this.watchdogTimer = setInterval(() => {
			if (Date.now() - this.lastMessageAt > CONNECTION_TIMEOUT_MS) {
				this.log('warn', 'Device connection timed out (no messages received), reconnecting')
				if (this.ws) {
					try {
						this.ws.terminate()
					} catch (e) {
						// ignore
					}
				}
			}
		}, 5000)
	}

	_stopWatchdog() {
		if (this.watchdogTimer) {
			clearInterval(this.watchdogTimer)
			this.watchdogTimer = null
		}
	}

	_clearTimers() {
		this._stopPing()
		this._stopWatchdog()
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
	}

	_handleMessage(data) {
		let msg
		try {
			msg = JSON.parse(data.toString())
		} catch (e) {
			this.log('warn', `Received invalid JSON from device: ${e.message}`)
			return
		}

		if (!msg || typeof msg.type !== 'string') return

		switch (msg.type) {
			case 'hello':
				this.log(
					'info',
					`Device hello: ${msg.device || 'unknown'} fw=${msg.fw_version || 'unknown'} gpi=${msg.gpi_count} gpo=${msg.gpo_count}`
				)
				this.emit('connect', msg)
				this.requestState()
				break

			case 'state':
				this._applyFullState(msg.gpi, msg.gpo)
				break

			case 'gpi_change':
				this._applyGpiChange(msg.pin, msg.state)
				break

			case 'gpo_ack':
				this._applyGpoChange(msg.pin, msg.state)
				break

			case 'pong':
				// liveness handled via lastMessageAt already
				break

			case 'error':
				this.log('warn', `Device reported error: ${msg.message}`)
				break

			default:
				this.log('debug', `Unknown message type from device: ${msg.type}`)
		}
	}

	_applyFullState(gpi, gpo) {
		if (Array.isArray(gpi)) {
			for (let i = 0; i < GPI_COUNT; i++) {
				this.gpi[i] = gpi[i] ? 1 : 0
			}
		}
		if (Array.isArray(gpo)) {
			for (let i = 0; i < GPO_COUNT; i++) {
				this.gpo[i] = gpo[i] ? 1 : 0
			}
		}
		this.emit('state', this.gpi.slice(), this.gpo.slice())
	}

	_applyGpiChange(pin, state) {
		if (typeof pin !== 'number' || pin < 0 || pin >= GPI_COUNT) return
		const value = state ? 1 : 0
		if (this.gpi[pin] === value) return
		this.gpi[pin] = value
		this.emit('gpi_change', pin, value)
	}

	_applyGpoChange(pin, state) {
		if (typeof pin !== 'number' || pin < 0 || pin >= GPO_COUNT) return
		const value = state ? 1 : 0
		if (this.gpo[pin] === value) return
		this.gpo[pin] = value
		this.emit('gpo_change', pin, value)
	}

	_send(obj) {
		if (!this.isConnected()) return false
		try {
			this.ws.send(JSON.stringify(obj))
			return true
		} catch (e) {
			this.log('warn', `Failed to send to device: ${e.message}`)
			return false
		}
	}

	setGpo(pin, state) {
		if (pin < 0 || pin >= GPO_COUNT) return
		const value = state ? 1 : 0
		this._send({ type: 'set_gpo', pin, state: value })
		// optimistic local update so feedbacks/variables react immediately
		this._applyGpoChange(pin, value)
	}

	setGpoBulk(pinStates) {
		// pinStates: array of { pin, state }
		this._send({ type: 'set_gpo_bulk', pins: pinStates })
		for (const { pin, state } of pinStates) {
			this._applyGpoChange(pin, state)
		}
	}

	setAllGpo(state) {
		const value = state ? 1 : 0
		const pins = []
		for (let i = 0; i < GPO_COUNT; i++) {
			pins.push({ pin: i, state: value })
		}
		this.setGpoBulk(pins)
	}

	requestState() {
		this._send({ type: 'get_state' })
	}
}
