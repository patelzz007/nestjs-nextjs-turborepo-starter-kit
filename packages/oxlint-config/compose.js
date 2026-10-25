/**
 * Composes oxlint configs into ONE resolved config, instead of oxlint's
 * `extends`.
 *
 * Through `extends`, oxlint 1.89 keeps an extended config's `rules`,
 * `overrides`, `plugins` and `options` but silently drops its `env`,
 * `globals`, `settings` and `ignorePatterns` (verified with `--print-config`:
 * the React version, the browser env and every ignore pattern vanish). Every
 * shared config in this package and every workspace's `oxlint.config.ts`
 * therefore composes with this function, whose merge rules are explicit and
 * covered by `__tests__/compose.test.js`:
 *
 * - `plugins`: union, in first-seen order;
 * - `jsPlugins`: union by plugin name (a later entry with the same name replaces
 *   the earlier one);
 * - `categories`, `options`, `env`, `globals`, `rules`: merged key by key, the
 *   later config winning;
 * - `settings`: merged per plugin key (`settings.react` from a later config
 *   replaces the earlier `settings.react`);
 * - `ignorePatterns`, `overrides`: concatenated in order, so a later override
 *   replaces a rule an earlier one set for the same files — the same
 *   "later block wins" order the shared configs are written in.
 *
 * `extends` is rejected: a composed config is already complete.
 *
 * @param {...import("oxlint").OxlintConfig} configs
 * @returns {import("oxlint").OxlintConfig}
 */
export function composeConfigs(...configs) {
	/** @type {import("oxlint").OxlintConfig} */
	const result = {};
	for (const config of configs) {
		if (config.extends !== undefined) {
			throw new Error(
				"composeConfigs: pass the configs to compose directly instead of using `extends` (oxlint drops env, globals, settings and ignorePatterns through extends).",
			);
		}
		if (config.plugins !== undefined) {
			result.plugins = [...new Set([...(result.plugins ?? []), ...config.plugins])];
		}
		if (config.jsPlugins !== undefined && config.jsPlugins !== null) {
			const byName = new Map((result.jsPlugins ?? []).map((plugin) => [pluginName(plugin), plugin]));
			for (const plugin of config.jsPlugins) {
				byName.set(pluginName(plugin), plugin);
			}
			result.jsPlugins = [...byName.values()];
		}
		for (const key of ["categories", "options", "env", "globals", "rules"]) {
			if (config[key] !== undefined) {
				result[key] = { ...result[key], ...config[key] };
			}
		}
		if (config.settings !== undefined) {
			result.settings = { ...result.settings, ...config.settings };
		}
		if (config.ignorePatterns !== undefined) {
			result.ignorePatterns = [...(result.ignorePatterns ?? []), ...config.ignorePatterns];
		}
		if (config.overrides !== undefined) {
			result.overrides = [...(result.overrides ?? []), ...config.overrides];
		}
	}
	return result;
}

/**
 * A `jsPlugins` entry's name: the explicit `name`, or the specifier itself.
 *
 * @param {string | { name: string, specifier: string }} plugin
 * @returns {string}
 */
function pluginName(plugin) {
	return plugin.name ?? plugin;
}
