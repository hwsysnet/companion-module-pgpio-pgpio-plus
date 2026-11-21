// Upgrade scripts run once when a connection's config was saved with an
// older version of this module.
import { parseTallyMapping } from './actions.js'
import { mappingToConfig, MAPPING_ROWS } from './mapping.js'

/**
 * 1.5.0: the "Tally mapping" and "GPI select mapping" text fields ("1=1, 2=2")
 * were replaced by rows of dropdowns. Valid entries become rows, invalid ones
 * were already ignored (with a warning) and are dropped.
 */
function textMappingsToRows(_context, props) {
	const result = { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
	const config = props.config
	if (!config) return result

	const updated = { ...config }
	let changed = false
	for (const [oldId, prefix, pinName] of [
		['tally_mapping', 'tally', 'GPO'],
		['gpi_select_mapping', 'gpi_select', 'GPI'],
	]) {
		if (!(oldId in config)) continue
		const { pairs } = parseTallyMapping(String(config[oldId] ?? ''), MAPPING_ROWS)
		Object.assign(updated, mappingToConfig(pairs, prefix, pinName))
		delete updated[oldId]
		changed = true
	}
	if (changed) result.updatedConfig = updated
	return result
}

/**
 * 1.5.0: BMD mode was added, on by default. Saved configs get it explicitly, so
 * the settings page (which shows rows by the saved value) matches the module.
 */
function addBmdMode(_context, props) {
	const result = { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
	const config = props.config
	if (config && !('bmd_mode' in config)) result.updatedConfig = { ...config, bmd_mode: true }
	return result
}

export default [textMappingsToRows, addBmdMode]
