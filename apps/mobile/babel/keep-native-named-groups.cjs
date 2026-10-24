// A Babel plugin for `marked`: it changes `marked`'s own files and leaves every other file alone.
//
// `marked` (16+) builds its inline rules by splicing one regex's `.source` into another,
// so its named capture groups, `(?<b>…)\k<b>`, must stay as written. On the phone they do:
// Metro compiles for Hermes, which has named groups, and leaves them native. Under Jest,
// babel-preset-expo compiles without the Hermes profile and rewrites each one into a
// numbered group wrapped by `_wrapRegExp`; the spliced source then holds `(…)\1`, and inside
// the bigger pattern `\1` names whichever group comes first — a code span swallowed the rest
// of a line's formatting. This rewrites each regex literal that declares a named group into
// `new RegExp(pattern, flags)`, which that transform leaves alone, so Jest runs `marked`
// exactly as the phone does (V8 has named groups too).

/**
 * `marked`'s own files, in pnpm's store (`.pnpm/marked@<version>/node_modules/marked/`) or hoisted.
 * Checked here, per file, not as a babel.config.js `overrides.test`: Metro also loads the config
 * without a filename, and Babel refuses a filename pattern then.
 */
const MARKED_FILES = /[\\/]node_modules[\\/]marked[\\/]/u;

/** A named group's opening, `(?<name>` — not a lookbehind, `(?<=` / `(?<!`. */
const NAMED_GROUP = /\(\?<[A-Za-z_$]/u;

module.exports = function keepNativeNamedGroups({ types }) {
	return {
		name: "keep-native-named-groups",
		visitor: {
			RegExpLiteral(path, state) {
				if (!MARKED_FILES.test(state.filename ?? "")) {
					return;
				}
				const { pattern, flags } = path.node;
				if (!NAMED_GROUP.test(pattern)) {
					return;
				}
				path.replaceWith(types.newExpression(types.identifier("RegExp"), [types.stringLiteral(pattern), types.stringLiteral(flags)]));
			},
		},
	};
};
