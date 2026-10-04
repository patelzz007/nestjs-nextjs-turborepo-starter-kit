/**
 * Rule-severity helpers for plugin presets.
 *
 * The repository rule is "every rule is `error`, never `warn`, and lint runs
 * with `--max-warnings=0`" (rules/00-non-negotiables.md). Plugin presets such
 * as `react-hooks` recommended and `@next/next` core-web-vitals ship some rules
 * as warnings; spreading them through this helper keeps every rule the preset
 * enables while making each one a hard error. Rules a preset turns off stay off.
 */

/** ESLint numeric severity for "warn" (0 = off, 1 = warn, 2 = error). */
const WARN_SEVERITY = 1;

/**
 * @param {import("eslint").Linter.RuleEntry} entry
 * @returns {boolean}
 */
function isWarning(entry) {
	const severity = Array.isArray(entry) ? entry[0] : entry;
	return severity === "warn" || severity === WARN_SEVERITY;
}

/**
 * Returns a copy of `rules` with every `warn` entry promoted to `error`,
 * preserving rule options.
 *
 * @param {Partial<import("eslint").Linter.RulesRecord>} rules
 * @returns {Partial<import("eslint").Linter.RulesRecord>}
 */
export function withErrorSeverity(rules) {
	return Object.fromEntries(
		Object.entries(rules).map(([ruleName, entry]) => {
			if (!isWarning(entry)) {
				return [ruleName, entry];
			}
			return [ruleName, Array.isArray(entry) ? ["error", ...entry.slice(1)] : "error"];
		}),
	);
}
