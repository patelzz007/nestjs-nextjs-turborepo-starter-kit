/**
 * The client-only widget allowlist rule (decision #58, plan §19.4).
 *
 * Every page server-renders. `next/dynamic(..., { ssr: false })` skips the
 * server render of one widget, so it is allowed only for a widget that cannot
 * render without the browser (a DOM API), and only from a dedicated wrapper:
 *
 * - the call lives in a file named `*.client-only.tsx`;
 * - that file's default export is a named component listed in
 *   `CLIENT_ONLY_WIDGETS` (`packages/ui/src/lib/client-only-widgets.ts`), each
 *   entry commented with the DOM API it needs;
 * - the wrapper's `loading` fallback is the widget's sized skeleton, which is
 *   also what the server renders.
 *
 * `ssr` must be written as a literal so lint can see it: a computed value
 * could turn the server render off without the allowlist knowing.
 *
 * Like `workspace-boundaries` (import-boundaries.js) this is a small local
 * rule built on ESLint core only, so no plugin dependency is needed.
 * Documented in docs/technical/tooling/eslint.md and rules/19.
 */

/** A wrapper file: the only place `ssr: false` may appear. */
const CLIENT_ONLY_FILE_PATTERN = /\.client-only\.tsx$/;

/** The specifiers `next/dynamic` is imported from. */
const NEXT_DYNAMIC_SOURCES = new Set(["next/dynamic", "next/dynamic.js"]);

/** The `next/dynamic` option that turns the server render off. */
const SSR_OPTION = "ssr";

/** The second argument of `dynamic(loader, options)`. */
const OPTIONS_ARGUMENT_POSITION = 1;

const ALLOWLIST_FILE = "packages/ui/src/lib/client-only-widgets.ts";

function propertyName(property) {
	if (property.type !== "Property" || property.computed) {
		return null;
	}
	if (property.key.type === "Identifier") {
		return property.key.name;
	}
	if (property.key.type === "Literal") {
		return String(property.key.value);
	}
	return null;
}

function isBooleanLiteral(node, value) {
	return node.type === "Literal" && node.value === value;
}

/** The name of a default export (`export default function Name`, `export default Name`), or null when it is anonymous. */
function defaultExportName(declaration) {
	if ((declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") && declaration.id !== null) {
		return declaration.id.name;
	}
	if (declaration.type === "Identifier") {
		return declaration.name;
	}
	return null;
}

const ssrFalseAllowlist = {
	meta: {
		type: "problem",
		docs: {
			description: "Allow `next/dynamic` with `ssr: false` only in `*.client-only.tsx` wrappers whose default export is in CLIENT_ONLY_WIDGETS.",
		},
		schema: [
			{
				type: "object",
				properties: {
					widgets: { type: "array", items: { type: "string" }, uniqueItems: true },
				},
				required: ["widgets"],
				additionalProperties: false,
			},
		],
		messages: {
			ssrFalseOutsideWrapper: `\`ssr: false\` is allowed only in a \`*.client-only.tsx\` wrapper listed in CLIENT_ONLY_WIDGETS (${ALLOWLIST_FILE}). Keep the server render (drop \`ssr: false\`), or wrap a browser-only widget in its own client-only file (decision #58).`,
			ssrNotLiteral: "Write `ssr` as the literal `true` or `false`: lint must see whether the server render is turned off (decision #58).",
			missingDefaultExport: `A \`*.client-only.tsx\` file must default-export its wrapper component, named in CLIENT_ONLY_WIDGETS (${ALLOWLIST_FILE}).`,
			anonymousDefaultExport: "Name the default export of a `*.client-only.tsx` file: the name is what CLIENT_ONLY_WIDGETS lists.",
			notAllowlisted: `"{{name}}" is not in CLIENT_ONLY_WIDGETS (${ALLOWLIST_FILE}). Add it there with a comment naming the DOM API it needs, or render the widget on the server.`,
		},
	},
	create(context) {
		const widgets = new Set(context.options[0]?.widgets ?? []);
		const isWrapperFile = CLIENT_ONLY_FILE_PATTERN.test(context.filename);
		const dynamicNames = new Set();
		let defaultExport = null;

		return {
			ImportDeclaration(node) {
				if (!NEXT_DYNAMIC_SOURCES.has(node.source.value)) {
					return;
				}
				for (const specifier of node.specifiers) {
					const isDefault = specifier.type === "ImportDefaultSpecifier" || (specifier.type === "ImportSpecifier" && specifier.imported.name === "default");
					if (isDefault) {
						dynamicNames.add(specifier.local.name);
					}
				}
			},
			CallExpression(node) {
				if (node.callee.type !== "Identifier" || !dynamicNames.has(node.callee.name)) {
					return;
				}
				const options = node.arguments.at(OPTIONS_ARGUMENT_POSITION);
				if (options?.type !== "ObjectExpression") {
					return;
				}
				const ssr = options.properties.find((property) => propertyName(property) === SSR_OPTION);
				if (ssr === undefined) {
					return;
				}
				if (!isBooleanLiteral(ssr.value, true) && !isBooleanLiteral(ssr.value, false)) {
					context.report({ node: ssr, messageId: "ssrNotLiteral" });
					return;
				}
				if (isBooleanLiteral(ssr.value, false) && !isWrapperFile) {
					context.report({ node: ssr, messageId: "ssrFalseOutsideWrapper" });
				}
			},
			ExportDefaultDeclaration(node) {
				defaultExport = node;
			},
			"Program:exit"(program) {
				if (!isWrapperFile) {
					return;
				}
				if (defaultExport === null) {
					context.report({ node: program, messageId: "missingDefaultExport" });
					return;
				}
				const name = defaultExportName(defaultExport.declaration);
				if (name === null) {
					context.report({ node: defaultExport, messageId: "anonymousDefaultExport" });
					return;
				}
				if (!widgets.has(name)) {
					context.report({ node: defaultExport, messageId: "notAllowlisted", data: { name } });
				}
			},
		};
	},
};

/** Local plugin carrying the allowlist rule. */
export const clientOnlyWidgetsPlugin = {
	meta: { name: "client-only-widgets" },
	rules: {
		"ssr-false-allowlist": ssrFalseAllowlist,
	},
};

const LINTED_SOURCE_FILES = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"];

/**
 * The rule, configured with an allowlist. `react-internal.js` (and so
 * `next.js`) turns it on with an empty list, which fails closed: a workspace
 * that renders client-only widgets passes `CLIENT_ONLY_WIDGETS` from
 * `@workspace/ui/lib/client-only-widgets` in its own eslint.config.js.
 *
 * @param {readonly string[]} widgets
 * @returns {import("eslint").Linter.Config}
 */
export function clientOnlyWidgetsConfig(widgets) {
	return {
		files: LINTED_SOURCE_FILES,
		plugins: {
			"client-only-widgets": clientOnlyWidgetsPlugin,
		},
		rules: {
			"client-only-widgets/ssr-false-allowlist": ["error", { widgets: [...widgets] }],
		},
	};
}
