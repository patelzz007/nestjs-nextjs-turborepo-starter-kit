/**
 * Import-boundary rules — the "architecture fitness checks" from
 * rules/01-repository-architecture.md, enforced by lint instead of memory.
 * Documented in docs/technical/tooling/eslint.md ("Import boundaries").
 *
 * Built only from ESLint core (`no-restricted-imports` with `regex` patterns)
 * plus one small local rule, so no extra plugin dependency is needed.
 *
 * `no-restricted-imports` is a single rule: a later config block REPLACES an
 * earlier block's options instead of merging them. So the frontend block
 * re-states the universal patterns (`[...UNIVERSAL, ...FRONTEND]`) rather than
 * relying on the base block — keep that in mind when adding patterns.
 */

/** Every workspace under apps/ (package names without the `@workspace/` scope). */
const APP_WORKSPACES = ["admin", "analytics-consumer", "api", "aws-infrastructure", "docs", "merchant", "web"];

/** Server/Node-only workspaces a browser bundle must never pull in. */
const SERVER_ONLY_WORKSPACES = ["messaging"];

/** Server/Node-only npm packages (database, queues, NestJS, native crypto). */
const SERVER_ONLY_PACKAGE_PATTERN =
	"^(@prisma/|prisma$|\\.prisma/|@nestjs/|bullmq$|ioredis$|@confluentinc/kafka-javascript$|kafkajs$|amqplib$|amqp-connection-manager$|bcrypt$|pg$)";

/** Patterns every workspace (frontend and backend) obeys. */
export const UNIVERSAL_RESTRICTED_IMPORT_PATTERNS = [
	{
		regex: `^@workspace/(${APP_WORKSPACES.join("|")})(/|$)`,
		message:
			"Apps are deployment units, not libraries: never import another app. Move the shared code into a packages/* workspace and import it through that package's `exports` (rules/01-repository-architecture.md).",
	},
	{
		regex: "^@workspace/[^/]+/(src|dist)(/|$)",
		message:
			"Do not reach into a package's src/ or dist/ internals. Import through the package's public `exports` entry points; if what you need is not exported, add a deliberate entry point (rules/00-non-negotiables.md, 'Imports and module hygiene').",
	},
	{
		regex: "^\\.{1,2}/(.*/)?(apps|packages)/",
		message: "Relative imports must not climb into another app or package. Depend on the workspace package and import its public entry point instead.",
	},
	{
		regex: "^@workspace/shared/",
		message: "@workspace/shared exposes a single public entry point. Import from `@workspace/shared` (add the symbol to its barrel if it is missing).",
	},
];

/** Extra patterns for browser-bundled code (Next apps, packages/client, packages/ui). */
export const FRONTEND_RESTRICTED_IMPORT_PATTERNS = [
	{
		regex: `^@workspace/(${SERVER_ONLY_WORKSPACES.join("|")})(/|$)`,
		message: "This workspace is Node/server-only (Kafka, BullMQ, Redis). Frontend code must not import it — call the API instead.",
	},
	{
		regex: SERVER_ONLY_PACKAGE_PATTERN,
		message: "Server-only dependency (database, queue, NestJS or native module). It must never be imported by frontend code — go through the API.",
	},
];

/** Frontend-only workspaces a Node backend must never pull in. */
const FRONTEND_ONLY_WORKSPACES = ["client", "ui"];

/** Frontend-only npm packages (React runtime, Next.js) — including their subpaths (`next/server`, `react/jsx-runtime`, …). */
const FRONTEND_ONLY_PACKAGE_PATTERN = "^(next|react|react-dom)(/|$)";

/** Extra patterns for Node backends (apps/api, apps/analytics-consumer, packages/messaging). */
export const BACKEND_RESTRICTED_IMPORT_PATTERNS = [
	{
		regex: `^@workspace/(${FRONTEND_ONLY_WORKSPACES.join("|")})(/|$)`,
		message:
			"This workspace is frontend-only (React components, browser API client). Backend code must not import it — share types/schemas through @workspace/shared instead (rules/01-repository-architecture.md).",
	},
	{
		regex: FRONTEND_ONLY_PACKAGE_PATTERN,
		message: "Frontend-only dependency (React / Next.js). A Node backend must never import it — keep rendering in the apps and share contracts through @workspace/shared.",
	},
];

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

/** Local plugin carrying the custom boundary rule. */
export const workspaceBoundariesPlugin = {
	meta: { name: "workspace-boundaries" },
	rules: {
		"no-server-import-in-client-component": noServerImportInClientComponent,
	},
};

const LINTED_SOURCE_FILES = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"];

/** Base block: applies to every workspace (used by base.js). */
export const universalImportBoundaryConfig = {
	files: LINTED_SOURCE_FILES,
	rules: {
		"no-restricted-imports": ["error", { patterns: UNIVERSAL_RESTRICTED_IMPORT_PATTERNS }],
	},
};

/** Backend block: universal + no-frontend patterns (used by nestjs.js and the Node workers). */
export const backendImportBoundaryConfig = {
	files: LINTED_SOURCE_FILES,
	rules: {
		"no-restricted-imports": ["error", { patterns: [...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...BACKEND_RESTRICTED_IMPORT_PATTERNS] }],
	},
};

/** Frontend block: universal + browser-safety patterns, plus the client-component rule. */
export const frontendImportBoundaryConfig = {
	files: LINTED_SOURCE_FILES,
	plugins: {
		"workspace-boundaries": workspaceBoundariesPlugin,
	},
	rules: {
		"no-restricted-imports": ["error", { patterns: [...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...FRONTEND_RESTRICTED_IMPORT_PATTERNS] }],
		"workspace-boundaries/no-server-import-in-client-component": "error",
	},
};
