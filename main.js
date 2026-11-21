import { InstanceBase, InstanceStatus } from '@companion-module/base'
import { getConfigFields } from './config.js'
import { getActions, parseTallyMapping } from './actions.js'
import { getFeedbacks } from './feedbacks.js'
import { getVariableDefinitions, gpiVariableValues, gpoVariableValues, toBool } from './variables.js'
import { getPresets } from './presets.js'
import UpgradeScripts from './upgrades.js'
import { DeviceConnection, GPI_COUNT } from './device-connection.js'

export default class PgpioPlusInstance extends InstanceBase {
	async init(config, _isFirstInit, _secrets) {
		this.config = config

		this.device = new DeviceConnection((level, msg) => this.log(level, msg))
		this._bindDeviceEvents()

		// pins currently held "on" by a Momentary Set GPO action (armed on press, disarmed on release)
		this.momentaryPins = new Set()
		// pin -> pending "back to rest state" timer of a Pulse GPO action
		this.pulseTimers = new Map()

		this.setFeedbackDefinitions(getFeedbacks(this))
		this._applyOptionalFeatures()

		const { presets, structure } = getPresets()
		this.setPresetDefinitions(structure, presets)

		this.setVariableValues({ device_status: toBool(false) })

		this._startDevice()
	}

	async destroy() {
		for (const timer of this.pulseTimers.values()) clearTimeout(timer)
		this.pulseTimers.clear()
		this.device.stop()
	}

	async configUpdated(config, _secrets) {
		const gpiSelectWasEnabled = !!this.config.gpi_select_enabled
		this.config = config
		this._applyOptionalFeatures(gpiSelectWasEnabled)
		// stop() does not emit 'disconnect', so clear the connection state here
		this.device.stop()
		this._setDeviceStatus(false)
		this._startDevice()
	}

	_setDeviceStatus(connected) {
		this.setVariableValues({ device_status: toBool(connected) })
		this.checkFeedbacks('device_status')
	}

	getConfigFields() {
		return getConfigFields()
	}

	_startDevice() {
		const { host, port } = this._resolveHostAndPort()
		if (!host || !port) {
			this.updateStatus(InstanceStatus.BadConfig, 'No device found or entered: select one or enter its IP address')
			return
		}
		this.device.configure(host, port, this.config.path, this.config.reconnect_interval)
		this.updateStatus(InstanceStatus.Connecting)
		this.device.start()
	}

	/**
	 * Bonjour/mDNS auto-discovery takes priority over the manual host/port
	 * fields: `bonjour_host` is "ip:port" (a string) when a device was found
	 * on the LAN, or falsy when the user has to fall back to manual entry.
	 */
	_resolveHostAndPort() {
		const bonjourHost = this.config.bonjour_host
		if (bonjourHost) {
			const sepIndex = bonjourHost.lastIndexOf(':')
			if (sepIndex !== -1) {
				return {
					host: bonjourHost.slice(0, sepIndex),
					port: Number(bonjourHost.slice(sepIndex + 1)),
				}
			}
		}
		return { host: this.config.host, port: this.config.port }
	}

	/**
	 * Tally from value / GPI select are switched on and off in the connection
	 * settings: their action and variable only exist while enabled.
	 */
	_applyOptionalFeatures(gpiSelectWasEnabled = false) {
		this.setActionDefinitions(getActions(this))
		this.setVariableDefinitions(getVariableDefinitions(this.config))

		// GPI pin (0-based) -> value; stays empty while GPI select is disabled
		this.gpiSelect = new Map()
		if (this.config.gpi_select_enabled) {
			const { pairs, errors } = parseTallyMapping(String(this.config.gpi_select_mapping ?? ''), GPI_COUNT)
			for (const err of errors) this.log('warn', `GPI select mapping: ${err}`)
			this.gpiSelect = new Map(pairs.map(({ key, pin }) => [pin, key]))
			if (!gpiSelectWasEnabled) this.setVariableValues({ gpi_selected_value: '' })
		}
	}

	_bindDeviceEvents() {
		this.device.on('connect', () => {
			this.updateStatus(InstanceStatus.Ok)
			this._setDeviceStatus(true)
		})

		this.device.on('disconnect', () => {
			this.updateStatus(InstanceStatus.ConnectionFailure, 'Disconnected, reconnecting...')
			this._setDeviceStatus(false)
		})

		this.device.on('error', (err) => {
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this._setDeviceStatus(false)
		})

		this.device.on('state', (gpi, gpo) => {
			this.setVariableValues({ ...gpiVariableValues(gpi), ...gpoVariableValues(gpo) })
			this.checkFeedbacks('gpi_state', 'gpo_state')
		})

		this.device.on('gpi_change', (pin, state) => {
			const values = gpiVariableValues(this.device.gpi)
			// only a closing contact selects; the value latches until another mapped GPI closes
			if (state && this.gpiSelect.has(pin)) {
				values.gpi_selected_value = this.gpiSelect.get(pin)
				this.log('debug', `GPI ${pin + 1} closed -> gpi_selected_value=${values.gpi_selected_value}`)
			}
			this.setVariableValues(values)
			this.checkFeedbacks('gpi_state')
		})

		this.device.on('gpo_change', () => {
			this.setVariableValues(gpoVariableValues(this.device.gpo))
			this.checkFeedbacks('gpo_state')
		})
	}
}

export { UpgradeScripts }
