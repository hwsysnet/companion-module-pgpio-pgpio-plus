import { combineRgb } from '@companion-module/base'
import { GPI_COUNT, GPO_COUNT } from './device-connection.js'

export function getPresets() {
	const presets = {}
	const gpiIds = []
	const gpoIds = []

	presets.device_status = {
		type: 'simple',
		name: 'Device status',
		style: {
			text: 'PGPIO+\nOffline',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{
				feedbackId: 'device_status',
				options: {},
				style: {
					text: 'PGPIO+\nOnline',
					bgcolor: combineRgb(0, 204, 0),
					color: combineRgb(0, 0, 0),
				},
			},
		],
	}

	for (let i = 0; i < GPI_COUNT; i++) {
		const id = `gpi_${i + 1}`
		presets[id] = {
			type: 'simple',
			name: `GPI ${i + 1}`,
			style: {
				text: `GPI ${i + 1}`,
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [{ down: [], up: [] }],
			feedbacks: [
				{
					feedbackId: 'gpi_state',
					options: { pin: i, state: true },
					style: {
						bgcolor: combineRgb(255, 0, 0),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		}
		gpiIds.push(id)
	}

	for (let i = 0; i < GPO_COUNT; i++) {
		const id = `gpo_${i + 1}`
		presets[id] = {
			type: 'simple',
			name: `GPO ${i + 1}`,
			style: {
				text: `GPO ${i + 1}`,
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_gpo',
							options: { pin: i, mode: 'toggle' },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'gpo_state',
					options: { pin: i, state: true },
					style: {
						bgcolor: combineRgb(0, 204, 0),
						color: combineRgb(0, 0, 0),
					},
				},
			],
		}
		gpoIds.push(id)
	}

	const gpoMomentaryIds = []
	for (let i = 0; i < GPO_COUNT; i++) {
		const id = `gpo_momentary_${i + 1}`
		presets[id] = {
			type: 'simple',
			name: `GPO ${i + 1} (Momentary)`,
			style: {
				text: `GPO ${i + 1}\n(mom.)`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_gpo',
							options: { pin: i, mode: 'momentary' },
						},
					],
					up: [
						{
							actionId: 'set_gpo',
							options: { pin: i, mode: 'momentary' },
						},
					],
				},
			],
			feedbacks: [
				{
					feedbackId: 'gpo_state',
					options: { pin: i, state: true },
					style: {
						bgcolor: combineRgb(0, 204, 0),
						color: combineRgb(0, 0, 0),
					},
				},
			],
		}
		gpoMomentaryIds.push(id)
	}

	const structure = [
		{ id: 'device', name: 'Device', definitions: ['device_status'] },
		{ id: 'gpi', name: 'GPI Inputs', definitions: gpiIds },
		{ id: 'gpo', name: 'GPO Outputs', definitions: gpoIds },
		{ id: 'gpo_momentary', name: 'GPO Outputs (Momentary / doorbell)', definitions: gpoMomentaryIds },
	]

	return { presets, structure }
}
