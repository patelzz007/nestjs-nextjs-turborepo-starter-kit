/**
 * `workspace/restricted-syntax` — bans AST shapes by esquery selector, with a
 * message per selector. The same option shape as ESLint's core
 * `no-restricted-syntax` (`{ selector, message }` objects, or bare selector
 * strings), which oxlint does not implement natively.
 *
 * The selectors themselves live in `restricted-syntax-rules.js` (type safety,
 * runtime validation, array-index readability, tenancy naming) and
 * `react-native.js` (React Native accessibility).
 */

const restrictedSyntax = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Disallow the AST shapes matched by the configured esquery selectors.",
		},
		schema: {
			type: "array",
			items: {
				oneOf: [
					{ type: "string" },
					{
						type: "object",
						properties: {
							selector: { type: "string" },
							message: { type: "string" },
						},
						required: ["selector"],
						additionalProperties: false,
					},
				],
			},
			uniqueItems: true,
			minItems: 1,
		},
		messages: {
			restrictedSyntax: "{{message}}",
		},
	},
	create(context) {
		/** @type {Record<string, (node: object) => void>} */
		const visitors = {};
		for (const option of context.options) {
			const { selector, message } = option.selector === undefined ? { selector: option, message: `Using '${option}' is not allowed.` } : option;
			const reportMessage = message ?? `Using '${selector}' is not allowed.`;
			const previous = visitors[selector];
			visitors[selector] = (node) => {
				previous?.(node);
				context.report({ node, messageId: "restrictedSyntax", data: { message: reportMessage } });
			};
		}
		return visitors;
	},
};

export default restrictedSyntax;
