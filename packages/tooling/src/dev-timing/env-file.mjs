/**
 * Reads ONE key from a dotenv file's text, for `pnpm dev:timing`: the API's
 * EMAIL_TEST_TO decides which Mailpit mailbox receives login codes. Values
 * are never printed by the caller. Supports `KEY=value`, `export KEY=value`,
 * single/double quotes and a trailing ` # comment` on unquoted values.
 */

/** `KEY=value` with an optional `export ` prefix. */
const ASSIGNMENT = /^\s*(?:export\s+)?(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.*?)\s*$/;
const QUOTED = /^(?<quote>["'])(?<inner>.*)\k<quote>$/;
const TRAILING_COMMENT = /\s+#.*$/;

/**
 * The value of the last assignment of `key`, or `undefined` when it is
 * missing, commented out or empty.
 *
 * @param {string} source
 * @param {string} key
 * @returns {string | undefined}
 */
export function readEnvValue(source, key) {
	let found = undefined;
	for (const line of source.split(/\r?\n/)) {
		const groups = ASSIGNMENT.exec(line)?.groups;
		if (groups?.key !== key || groups.value === undefined) {
			continue;
		}
		const quoted = QUOTED.exec(groups.value)?.groups?.inner;
		const value = quoted ?? groups.value.replace(TRAILING_COMMENT, "");
		found = value.length > 0 ? value : undefined;
	}
	return found;
}
