/**
 * `workspace/no-server-import-in-client-component` — a "use client" file may
 * not import a server-only module (rules/03, rules/10). Type-only imports are
 * erased and therefore allowed. Transitive imports cannot be seen by lint;
 * `import "server-only"` in the server module makes `next build` catch those.
 */

/**
 * Module specifiers that are server-only by convention. A Client Component
 * ("use client") importing one of these fails at build time at best and ships
 * a secret at worst.
 */
export const SERVER_ONLY_SPECIFIER_PATTERNS = [
	"^server-only$",
	"^next/headers$",
	// App/package naming convention for server modules:
	//   lib/env/env.server, lib/auth/server, lib/navigation/server,
	//   lib/auth-server, lib/<app>-server-api, lib/api/server-api, lib/api/server-request
	"(^|/)env\\.server$",
	"(^|/)server$",
	"(^|/)auth-server$",
	"-server-api$",
	"(^|/)server-(api|request)$",
];

function isTypeOnlyImport(node) {
	if (node.importKind === "type") return true;
	return node.specifiers.length > 0 && node.specifiers.every((specifier) => specifier.type === "ImportSpecifier" && specifier.importKind === "type");
}

function hasUseClientDirective(program) {
	for (const statement of program.body) {
		if (statement.type !== "ExpressionStatement" || typeof statement.directive !== "string") {
			return false;
		}
		if (statement.directive === "use client") {
			return true;
		}
	}
	return false;
}

/**
 * Flags value imports of server-only modules from files that start with the
 * "use client" directive. Type-only imports are erased and therefore allowed.
 * Transitive imports cannot be seen by lint; `import "server-only"` in the
 * server module makes `next build` catch those.
 */
const noServerImportInClientComponent = {
	meta: {
		type: "problem",
		docs: {
			description: 'Disallow importing server-only modules from "use client" files.',
		},
		schema: [
			{
				type: "object",
				properties: {
					patterns: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
		messages: {
			serverImport:
				'"{{source}}" is server-only, but this file is a Client Component ("use client"). Pass the value in as a prop from a Server Component, or read public config from lib/env/env.client.',
		},
	},
	create(context) {
		if (!hasUseClientDirective(context.sourceCode.ast)) {
			return {};
		}
		const options = context.options[0] ?? {};
		const matchers = (options.patterns ?? SERVER_ONLY_SPECIFIER_PATTERNS).map((pattern) => new RegExp(pattern));

		function check(sourceNode) {
			if (sourceNode?.type !== "Literal" || typeof sourceNode.value !== "string") return;
			const source = sourceNode.value;
			if (matchers.some((matcher) => matcher.test(source))) {
				context.report({ node: sourceNode, messageId: "serverImport", data: { source } });
			}
		}

		return {
			ImportDeclaration(node) {
				if (!isTypeOnlyImport(node)) check(node.source);
			},
			ExportNamedDeclaration(node) {
				if (node.source && node.exportKind !== "type") check(node.source);
			},
			ExportAllDeclaration(node) {
				if (node.exportKind !== "type") check(node.source);
			},
			ImportExpression(node) {
				check(node.source);
			},
		};
	},
};

export default noServerImportInClientComponent;
