/**
 * The mechanical half of the React Native UI kit's contract
 * (packages/ui-native/README.md → "The contract every component meets"),
 * checked over each component's source. The judgement calls (is it stateless,
 * is its copy generic?) stay with review; what a regular expression can see,
 * this checks, so the kit cannot drift:
 *
 * - every exported component is `React.memo` around `React.forwardRef`;
 * - it styles itself through CVA (`cva(`), or is one of the few composites that
 *   take their variants from the kit component they compose;
 * - only design tokens: no arbitrary values (`w-[13px]`), no hex colours, no
 *   `style={{ … }}` literals, no font-weight utilities (React Native picks a
 *   weight by font family — rules/04);
 * - no object or array literal created inline in a JSX prop (`prop={{ … }}`,
 *   `prop={[ … ]}`): a new identity every render defeats `React.memo` below;
 * - it has its own test in `__tests__/<name>.test.tsx`.
 */

/**
 * Composites with no CVA of their own: their `variant` / `size` / `state` are
 * the composed component's, passed through (their props extend its props).
 * Each must import the module named here.
 */
export const COMPOSED_COMPONENTS = {
	combobox: "./select-field",
	"date-field": "./calendar-field",
	"multi-date-field": "./calendar-field",
	"text-field": "./input",
};

/** The source without comments, so prose that NAMES a banned pattern is not flagged. */
export function stripComments(source) {
	return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:"'`])\/\/.*$/gmu, "$1");
}

/** PascalCase exported constants that are components (not `ICON_SIZES`, not a `…Context`). */
const EXPORTED_COMPONENT = /^export const (?<name>[A-Z][a-z]\w*)(?::[^=]+)? = (?<init>.*)$/gmu;
const EXPORTED_FUNCTION_COMPONENT = /^export function (?<name>[A-Z][a-z]\w*)/gmu;
const ARBITRARY_VALUE = /["'`][^"'`\n]*\b[a-z][\w-]*-\[[^\]\s]+\][^"'`\n]*["'`]/u;
const HEX_COLOUR = /["'`][^"'`\n]*#[0-9a-fA-F]{3,8}\b[^"'`\n]*["'`]/u;
const STYLE_LITERAL = /style=\{\{/u;
const FONT_WEIGHT_UTILITY = /\bfont-(?:medium|semibold|bold)\b/u;
const INLINE_PROP_LITERAL = /\w=\{\s*[{[]/u;

/**
 * The contract problems of one component file.
 *
 * @param {string} name the file name without `.tsx` (`button`)
 * @param {string} source the file's source
 * @param {boolean} hasTest whether `__tests__/<name>.test.tsx` exists
 * @returns {string[]}
 */
export function kitContractProblems(name, source, hasTest) {
	const code = stripComments(source);
	const problems = [];
	if (!code.includes("forwardRef")) {
		problems.push("no React.forwardRef: every component forwards its ref");
	}
	for (const match of code.matchAll(EXPORTED_COMPONENT)) {
		const { name: component, init } = match.groups;
		if (!component.endsWith("Context") && !init.includes("memo(")) {
			problems.push(`${component} is not wrapped in React.memo`);
		}
	}
	for (const match of code.matchAll(EXPORTED_FUNCTION_COMPONENT)) {
		problems.push(`${match.groups.name} is a plain function: export React.memo(React.forwardRef(…))`);
	}
	const composedFrom = COMPOSED_COMPONENTS[name];
	if (!code.includes("cva(")) {
		if (composedFrom === undefined) {
			problems.push("no cva(): style through a CVA variant function");
		} else if (!code.includes(`from "${composedFrom}"`)) {
			problems.push(`a composite without cva() must compose ${composedFrom}`);
		}
	}
	if (ARBITRARY_VALUE.test(code)) {
		problems.push("an arbitrary Tailwind value (`x-[…]`): use a design token");
	}
	if (HEX_COLOUR.test(code)) {
		problems.push("a hex colour: use a design token");
	}
	if (STYLE_LITERAL.test(code)) {
		problems.push("a style={{ … }} literal: use token classes (an animated style variable is fine)");
	}
	if (INLINE_PROP_LITERAL.test(code)) {
		problems.push("an object or array literal in a JSX prop: hoist it to a constant or useMemo");
	}
	if (FONT_WEIGHT_UTILITY.test(code)) {
		problems.push("a font-weight utility: use a font family utility (font-sans-semibold)");
	}
	if (!hasTest) {
		problems.push(`no test: add __tests__/${name}.test.tsx`);
	}
	return problems;
}
