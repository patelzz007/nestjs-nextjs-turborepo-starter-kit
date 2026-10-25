/**
 * `workspace/restricted-imports` — the import-boundary rule (rules/01, the
 * "architecture fitness checks"; the patterns live in `import-boundaries.js`).
 *
 * It mirrors the part of ESLint's core `no-restricted-imports` this repository
 * uses — `patterns: [{ regex, message }]` and `paths: [{ name, importNames,
 * message }]` — with the same matching semantics:
 *
 * - checked on `import … from`, `export … from` and `export * from`
 *   (type-only imports included; `import()` and `require()` are not checked);
 * - a pattern's `regex` is a JavaScript RegExp, case-insensitive unless
 *   `caseSensitive: true` (ESLint's default);
 * - a path with `importNames` reports only those names (a namespace import or
 *   `export *` of the module counts as importing all of them).
 *
 * Why not oxlint's native `no-restricted-imports`: it compiles `regex` with a
 * Rust engine that has no lookaround and silently matches nothing for a
 * pattern such as `^@nestjs/(?!common$|cqrs$)` — two of the repository's
 * boundaries (the DDD application layer and the frontend context index rule)
 * depend on lookahead. A JavaScript RegExp keeps every boundary exactly as
 * strict as it was, and an invalid pattern throws instead of being ignored.
 */

const restrictedImports = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow imports that cross an architecture boundary.",
		},
		schema: [
			{
				type: "object",
				properties: {
					paths: {
						type: "array",
						items: {
							type: "object",
							properties: {
								name: { type: "string" },
								importNames: { type: "array", items: { type: "string" }, minItems: 1, uniqueItems: true },
								message: { type: "string" },
							},
							required: ["name"],
							additionalProperties: false,
						},
					},
					patterns: {
						type: "array",
						items: {
							type: "object",
							properties: {
								regex: { type: "string" },
								caseSensitive: { type: "boolean" },
								message: { type: "string" },
							},
							required: ["regex"],
							additionalProperties: false,
						},
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			path: "'{{source}}' import is restricted from being used. {{message}}",
			importName: "'{{importName}}' import from '{{source}}' is restricted. {{message}}",
			everything: "* import is invalid because '{{importNames}}' from '{{source}}' is restricted. {{message}}",
			pattern: "'{{source}}' import is restricted from being used by a pattern. {{message}}",
		},
	},
	create(context) {
		const options = context.options[0] ?? {};
		const paths = (options.paths ?? []).map((path) => ({ ...path, message: path.message ?? "" }));
		const patterns = (options.patterns ?? []).map((pattern) => ({
			matcher: new RegExp(pattern.regex, pattern.caseSensitive === true ? "u" : "iu"),
			message: pattern.message ?? "",
		}));

		/**
		 * @param {{ value: string }} sourceNode
		 * @param {readonly { kind: "named", name: string, node: object }[] | "everything" | "none"} imported
		 * @param {object} reportNode
		 * @param {object} [everythingNode] where an "everything" report points (ESLint points at the `* as name` specifier)
		 */
		function check(sourceNode, imported, reportNode, everythingNode = reportNode) {
			const source = sourceNode.value;
			for (const path of paths) {
				if (path.name !== source) {
					continue;
				}
				if (path.importNames === undefined) {
					context.report({ node: reportNode, messageId: "path", data: { source, message: path.message } });
					continue;
				}
				if (imported === "everything") {
					context.report({ node: everythingNode, messageId: "everything", data: { source, importNames: path.importNames.join(", "), message: path.message } });
					continue;
				}
				if (imported === "none") {
					continue;
				}
				for (const specifier of imported) {
					if (path.importNames.includes(specifier.name)) {
						context.report({ node: specifier.node, messageId: "importName", data: { source, importName: specifier.name, message: path.message } });
					}
				}
			}
			for (const pattern of patterns) {
				if (pattern.matcher.test(source)) {
					context.report({ node: reportNode, messageId: "pattern", data: { source, message: pattern.message } });
				}
			}
		}

		/** The name a specifier imports from the module (`default` for a default import). */
		function moduleExportName(nameNode) {
			return nameNode.type === "Identifier" ? nameNode.name : String(nameNode.value);
		}

		return {
			ImportDeclaration(node) {
				const namespace = node.specifiers.find((specifier) => specifier.type === "ImportNamespaceSpecifier");
				if (namespace !== undefined) {
					check(node.source, "everything", node, namespace);
					return;
				}
				if (node.specifiers.length === 0) {
					check(node.source, "none", node);
					return;
				}
				const imported = node.specifiers.map((specifier) => ({
					kind: "named",
					name: specifier.type === "ImportDefaultSpecifier" ? "default" : moduleExportName(specifier.imported),
					node: specifier,
				}));
				check(node.source, imported, node);
			},
			ExportNamedDeclaration(node) {
				if (node.source === null || node.source === undefined) {
					return;
				}
				const exported = node.specifiers.map((specifier) => ({ kind: "named", name: moduleExportName(specifier.local), node: specifier }));
				check(node.source, exported, node);
			},
			ExportAllDeclaration(node) {
				check(node.source, "everything", node);
			},
		};
	},
};

export default restrictedImports;
