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

import { builtinModules } from "node:module";

/** Every workspace under apps/ (package names without the `@workspace/` scope). */
const APP_WORKSPACES = ["admin", "analytics-consumer", "api", "aws-infrastructure", "docs", "merchant", "mobile", "web"];

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
const FRONTEND_ONLY_WORKSPACES = ["api-client", "client", "ui"];

/** Frontend-only npm packages (React runtime, Next.js) — including their subpaths (`next/server`, `react/jsx-runtime`, …). */
const FRONTEND_ONLY_PACKAGE_PATTERN = "^(next|react|react-dom)(/|$)";

/** Extra patterns for Node backends (apps/api, apps/analytics-consumer, packages/messaging). */
export const BACKEND_RESTRICTED_IMPORT_PATTERNS = [
	{
		regex: `^@workspace/(${FRONTEND_ONLY_WORKSPACES.join("|")})(/|$)`,
		message:
			"This workspace is frontend-only (React components, the web/mobile API client). Backend code must not import it — share types/schemas through @workspace/shared instead (rules/01-repository-architecture.md).",
	},
	{
		regex: FRONTEND_ONLY_PACKAGE_PATTERN,
		message: "Frontend-only dependency (React / Next.js). A Node backend must never import it — keep rendering in the apps and share contracts through @workspace/shared.",
	},
];

// ── @workspace/api-client: portable core + React entry ───────────────────────
// The API client is shared by the Next apps AND the React Native app
// (docs/technical/mobile/mobile-app.md §4), so it may only use what both
// runtimes provide. Its core ("." → src/**) imports no React, Next, DOM-only
// or Node code; its React entry ("./react" → src/react/**) adds `react` and
// `@tanstack/react-query`, nothing else.

/** Node built-in modules, bare (`fs`) and prefixed (`node:fs`) — none exists in React Native. */
const NODE_BUILTIN_PATTERN = `^(node:|(${builtinModules.map((name) => name.replace(/[/]/g, "\\/")).join("|")})(/|$))`;

/** Imports neither entry of the API client may use: Next, react-dom, the web packages, Node built-ins. */
export const API_CLIENT_PORTABLE_RESTRICTED_IMPORT_PATTERNS = [
	{
		regex: "^(next|react-dom|server-only)(/|$)",
		message:
			"@workspace/api-client runs in the Next apps AND React Native: it must not import next, react-dom or server-only. Keep web-only code in @workspace/client (docs/technical/mobile/mobile-app.md §4).",
	},
	{
		regex: "^@workspace/(client|ui)(/|$)",
		message:
			"@workspace/api-client sits below the web packages (@workspace/client depends on it): importing them creates a cycle and drags web-only code into the mobile app.",
	},
	{
		regex: NODE_BUILTIN_PATTERN,
		message: "Node built-in modules do not exist in React Native or the browser. @workspace/api-client may only use fetch, URL, FormData and AbortSignal.",
	},
];

/** Extra imports the API client CORE may not use: React and its TanStack Query adapter belong to the "./react" entry. */
export const API_CLIENT_CORE_RESTRICTED_IMPORT_PATTERNS = [
	{
		regex: "^(react|@tanstack/react-query)(/|$)",
		message:
			'The @workspace/api-client core is framework-free. Put React / TanStack Query bindings in src/react/ (the "./react" entry), and keep plain data (such as query keys) in the core.',
	},
];

/**
 * Globals neither entry of the API client may touch: DOM-only browser APIs
 * (React Native has none of them; `fetch`, `URL`, `Headers`, `FormData`,
 * `AbortSignal` and `Response` stay allowed) and Node globals.
 */
export const API_CLIENT_RESTRICTED_GLOBALS = [
	...["window", "document", "navigator", "location", "history", "localStorage", "sessionStorage", "indexedDB", "DOMException", "BroadcastChannel", "self"].map((name) => ({
		name,
		message: `\`${name}\` is a browser-only global; @workspace/api-client also runs in React Native. Inject what you need through the client config instead.`,
	})),
	...["process", "Buffer", "global", "__dirname", "__filename", "require", "module", "setImmediate"].map((name) => ({
		name,
		message: `\`${name}\` is a Node global; @workspace/api-client also runs in React Native and the browser. Inject what you need through the client config instead.`,
	})),
];

const API_CLIENT_SOURCE_FILES = ["src/**/*.ts", "src/**/*.tsx"];

const API_CLIENT_TEST_FILES = ["src/**/*.test.ts", "src/**/*.test.tsx"];

const API_CLIENT_REACT_ENTRY_FILES = ["src/react/**/*.ts", "src/react/**/*.tsx"];

/**
 * The boundary blocks of packages/api-client, in order: the core import rules
 * on every source file, the global bans on shipped (non-test) files, then the
 * React entry's import rules (which re-state the portable patterns, since a
 * later `no-restricted-imports` block replaces an earlier one).
 */
export const apiClientBoundaryConfigs = [
	{
		files: API_CLIENT_SOURCE_FILES,
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS,
						...FRONTEND_RESTRICTED_IMPORT_PATTERNS,
						...API_CLIENT_PORTABLE_RESTRICTED_IMPORT_PATTERNS,
						...API_CLIENT_CORE_RESTRICTED_IMPORT_PATTERNS,
					],
				},
			],
		},
	},
	{
		// Shipped code only: a test may build the platform's own objects (a browser
		// `DOMException` abort) to prove the client handles them.
		files: API_CLIENT_SOURCE_FILES,
		ignores: API_CLIENT_TEST_FILES,
		rules: {
			"no-restricted-globals": ["error", ...API_CLIENT_RESTRICTED_GLOBALS],
		},
	},
	{
		files: API_CLIENT_REACT_ENTRY_FILES,
		rules: {
			"no-restricted-imports": [
				"error",
				{ patterns: [...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...FRONTEND_RESTRICTED_IMPORT_PATTERNS, ...API_CLIENT_PORTABLE_RESTRICTED_IMPORT_PATTERNS] },
			],
		},
	},
];

// ── apps/mobile: the Expo app (React Native) ─────────────────────────────────
// The mobile app runs on Hermes in React Native: no DOM, no Node, no Next. It
// may import @workspace/shared, both entries of @workspace/api-client and the
// generated token CSS (docs/technical/mobile/mobile-app.md §4); the web-only
// packages would drag react-dom, Next and the DOM into the native bundle.

/** Imports the mobile app may not use, on top of the universal and frontend patterns. */
export const MOBILE_RESTRICTED_IMPORT_PATTERNS = [
	{
		regex: "^(next|react-dom|server-only)(/|$)",
		message: "apps/mobile is a React Native app: next, react-dom and server-only do not exist there. Use react-native / expo-* APIs (docs/technical/mobile/mobile-app.md §4).",
	},
	{
		regex: "^@workspace/(client|ui)(/|$)",
		message:
			"@workspace/client and @workspace/ui are web-only (react-dom, Next, Radix). The mobile app talks to the API through @workspace/api-client and builds its own React Native components in src/components.",
	},
	{
		regex: NODE_BUILTIN_PATTERN,
		message: "Node built-in modules do not exist in React Native (Hermes). Use the Expo module that provides the capability instead.",
	},
	{
		regex: "^@react-native-async-storage/",
		message:
			"AsyncStorage is unencrypted and banned in this repository (rules/04-mobile-expo.md, mobile-app.md §9.7). Use the typed Secure Store wrapper in src/lib/secure-store.ts.",
	},
];

/** Browser-only and Node-only globals React Native does not provide (RN's own `fetch`, `URL`, `FormData`, timers stay allowed). */
export const MOBILE_RESTRICTED_GLOBALS = [
	...["document", "localStorage", "sessionStorage", "indexedDB", "DOMException", "BroadcastChannel"].map((name) => ({
		name,
		message: `\`${name}\` is a browser-only global; React Native does not provide it. Use the React Native / Expo API (Secure Store for storage).`,
	})),
	...["Buffer", "__dirname", "__filename"].map((name) => ({
		name,
		message: `\`${name}\` is a Node global; the mobile app runs on Hermes, not Node.`,
	})),
];

/**
 * The app's bundled source. `.cjs` / `.mjs` files are Node tooling run on the
 * developer's machine (the Jest resolver, test stubs) and are never bundled.
 */
const MOBILE_SOURCE_FILES = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"];

/**
 * The boundary block of apps/mobile: universal + frontend (no server-only
 * workspaces or packages) + the mobile patterns above, and the global bans.
 */
export const mobileImportBoundaryConfig = {
	files: MOBILE_SOURCE_FILES,
	rules: {
		"no-restricted-imports": ["error", { patterns: [...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...FRONTEND_RESTRICTED_IMPORT_PATTERNS, ...MOBILE_RESTRICTED_IMPORT_PATTERNS] }],
		"no-restricted-globals": ["error", ...MOBILE_RESTRICTED_GLOBALS],
	},
};

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
