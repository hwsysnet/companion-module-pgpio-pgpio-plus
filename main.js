import { InstanceBase, InstanceStatus } from '@companion-module/base'
import { getConfigFields } from './config.js'
import { getActions } from './actions.js'
import { getFeedbacks } from './feedbacks.js'
import { getVariableDefinitions, gpiVariableValues, gpoVariableValues, toBool } from './variables.js'
import { getPresets } from './presets.js'
import UpgradeScripts from './upgrades.js'
import { DeviceConnection } from './device-connection.js'

export default class PgpioPlusInstance extends InstanceBase {
	async init(config, _isFirstInit, _secrets) {
		this.config = config

		this.device = new DeviceConnection((level, msg) => this.log(level, msg))
		this._bindDeviceEvents()

		// pins currently held "on" by a Momentary Set GPO action (armed on press, disarmed on release)
		this.momentaryPins = new Set()

		this.setActionDefinitions(getActions(this))
		this.setFeedbackDefinitions(getFeedbacks(this))
		this.setVariableDefinitions(getVariableDefinitions())

		const { presets, structure } = getPresets()
		this.setPresetDefinitions(structure, presets)

		this.setVariableValues({ device_status: toBool(false) })

		this.updateStatus(InstanceStatus.Connecting)
		this._applyConfigToDevice()
		this.device.start()
	}

	async destroy() {
		this.device.stop()
	}

	async configUpdated(config, _secrets) {
		this.config = config
		this.device.stop()
		this._applyConfigToDevice()
		this.updateStatus(InstanceStatus.Connecting)
		this.device.start()
	}

	getConfigFields() {
		return getConfigFields()
	}

	_applyConfigToDevice() {
		const { host, port } = this._resolveHostAndPort()
		this.device.configure(host, port, this.config.path, this.config.reconnect_interval)
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

	_bindDeviceEvents() {
		this.device.on('connect', () => {
			this.updateStatus(InstanceStatus.Ok)
			this.setVariableValues({ device_status: toBool(true) })
			this.checkFeedbacks('device_status')
		})

		this.device.on('disconnect', () => {
			this.updateStatus(InstanceStatus.ConnectionFailure, 'Disconnected, reconnecting...')
			this.setVariableValues({ device_status: toBool(false) })
			this.checkFeedbacks('device_status')
		})

		this.device.on('error', (err) => {
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this.setVariableValues({ device_status: toBool(false) })
			this.checkFeedbacks('device_status')
		})

		this.device.on('state', (gpi, gpo) => {
			this.setVariableValues({ ...gpiVariableValues(gpi), ...gpoVariableValues(gpo) })
			this.checkFeedbacks('gpi_state', 'gpo_state')
		})

		this.device.on('gpi_change', (pin) => {
			this.setVariableValues(gpiVariableValues(this.device.gpi))
			this.checkFeedbacks('gpi_state')
			void pin
		})

		this.device.on('gpo_change', (pin) => {
			this.setVariableValues(gpoVariableValues(this.device.gpo))
			this.checkFeedbacks('gpo_state')
			void pin
		})
	}
}

export { UpgradeScripts }
