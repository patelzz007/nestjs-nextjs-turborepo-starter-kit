/**
 * Import-boundary rules — the "architecture fitness checks" from
 * rules/01-repository-architecture.md, enforced by lint instead of memory.
 * Documented in docs/technical/tooling/oxlint.md ("Import boundaries").
 *
 * The patterns are checked by `workspace/restricted-imports` (plugin/), which
 * matches them as JavaScript RegExps — several rely on lookahead, which
 * oxlint's native `no-restricted-imports` silently ignores.
 *
 * `workspace/restricted-imports` is a single rule: a later override REPLACES
 * an earlier one's options instead of merging them. So the frontend block
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
	{
		regex: "^@workspace/api(/|$)",
		message: "The Nest API package is server-only. Frontend and mobile code call it through @workspace/api-client.",
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
 * later `workspace/restricted-imports` override replaces an earlier one).
 */
export const apiClientBoundaryConfigs = [
	{
		files: API_CLIENT_SOURCE_FILES,
		rules: {
			"workspace/restricted-imports": [
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
		excludeFiles: API_CLIENT_TEST_FILES,
		rules: {
			"no-restricted-globals": ["error", ...API_CLIENT_RESTRICTED_GLOBALS],
		},
	},
	{
		files: API_CLIENT_REACT_ENTRY_FILES,
		rules: {
			"workspace/restricted-imports": [
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
			"@workspace/client and @workspace/ui are web-only (react-dom, Next, Base UI). The mobile app talks to the API through @workspace/api-client and builds its own React Native components in src/components.",
	},
	{
		regex: NODE_BUILTIN_PATTERN,
		message: "Node built-in modules do not exist in React Native (Hermes). Use the Expo module that provides the capability instead.",
	},
	{
		regex: "^@workspace/api(/|$)",
		message: "apps/mobile must not import the Nest API. Talk to it through @workspace/api-client (docs/technical/mobile/mobile-app.md §4).",
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
		"workspace/restricted-imports": [
			"error",
			{ patterns: [...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...FRONTEND_RESTRICTED_IMPORT_PATTERNS, ...MOBILE_RESTRICTED_IMPORT_PATTERNS] },
		],
		"no-restricted-globals": ["error", ...MOBILE_RESTRICTED_GLOBALS],
	},
};

const LINTED_SOURCE_FILES = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"];

/** Base block: applies to every workspace (used by base.js). */
export const universalImportBoundaryConfig = {
	files: LINTED_SOURCE_FILES,
	rules: {
		"workspace/restricted-imports": ["error", { patterns: UNIVERSAL_RESTRICTED_IMPORT_PATTERNS }],
	},
};

/** Backend block: universal + no-frontend patterns (used by nestjs.js and the Node workers). */
export const backendImportBoundaryConfig = {
	files: LINTED_SOURCE_FILES,
	rules: {
		"workspace/restricted-imports": ["error", { patterns: [...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...BACKEND_RESTRICTED_IMPORT_PATTERNS] }],
	},
};

// ── apps/api DDD layers (T10, docs/architecture/ddd-cqrs-migration-plan.md §12.1)

/** The 14 bounded contexts (§6.1). */
export const DDD_CONTEXTS = [
	"identity",
	"authorization",
	"tenancy",
	"rewards",
	"claims",
	"pos",
	"referrals",
	"reporting",
	"files",
	"notifications",
	"catalog",
	"reference-data",
	"audit",
	"integrations-github",
	"kanban",
	"operations",
];

const DOMAIN_PURITY_MESSAGE = "Domain is pure: no framework, no persistence, no outer layers (decision #6).";
const APPLICATION_PORTS_MESSAGE = "Application depends on ports, never adapters.";
const PRESENTATION_MESSAGE = "Presentation dispatches commands/queries; it never touches persistence.";
const PUBLIC_API_MESSAGE = "Import another context only through its public-api.ts (§6.4).";
const PRISMA_BASE_MESSAGE = "PrismaBaseRepository is infrastructure-only.";
const PLATFORM_NO_CONTEXTS_MESSAGE = "Platform must not depend on contexts.";
const PLATFORM_PUBLIC_API_MESSAGE = "Platform may only use a context's public-api (for the error map and security kit).";
const SYSTEM_COMMAND_MESSAGE = "Non-HTTP entry points dispatch through SystemCommandDispatcher (decision #27).";

const LAYER_SEGMENT = "(domain|application|infrastructure|presentation)";

const DOMAIN_LAYER_PATTERNS = [
	{ regex: "^@nestjs/", message: DOMAIN_PURITY_MESSAGE },
	{ regex: "^@prisma/", message: DOMAIN_PURITY_MESSAGE },
	{ regex: "^\\.prisma/", message: DOMAIN_PURITY_MESSAGE },
	{ regex: "^prisma$", message: DOMAIN_PURITY_MESSAGE },
	{ regex: "^pg$", message: DOMAIN_PURITY_MESSAGE },
	{ regex: "^bullmq$", message: DOMAIN_PURITY_MESSAGE },
	{ regex: "^ioredis$", message: DOMAIN_PURITY_MESSAGE },
	{ regex: `/(application|infrastructure|presentation)(/|$)`, message: DOMAIN_PURITY_MESSAGE },
	{ regex: "platform/(application|infrastructure|presentation)(/|$)", message: DOMAIN_PURITY_MESSAGE },
];

const APPLICATION_LAYER_PATTERNS = [
	{ regex: "^@prisma/", message: APPLICATION_PORTS_MESSAGE },
	{ regex: "^\\.prisma/", message: APPLICATION_PORTS_MESSAGE },
	{ regex: "^pg$", message: APPLICATION_PORTS_MESSAGE },
	{ regex: "^bullmq$", message: APPLICATION_PORTS_MESSAGE },
	{ regex: "^ioredis$", message: APPLICATION_PORTS_MESSAGE },
	{ regex: "^@nestjs/(?!common$|cqrs$)", message: APPLICATION_PORTS_MESSAGE },
	{ regex: "/(infrastructure|presentation)(/|$)", message: APPLICATION_PORTS_MESSAGE },
	{ regex: "platform/(infrastructure|presentation)(/|$)", message: APPLICATION_PORTS_MESSAGE },
	{ regex: "(^|/)prisma/", message: APPLICATION_PORTS_MESSAGE },
];

const PRESENTATION_LAYER_PATTERNS = [
	{ regex: "^@prisma/", message: PRESENTATION_MESSAGE },
	{ regex: "^\\.prisma/", message: PRESENTATION_MESSAGE },
	{ regex: "^pg$", message: PRESENTATION_MESSAGE },
	{ regex: "/infrastructure(/|$)", message: PRESENTATION_MESSAGE },
	{ regex: "platform/infrastructure(/|$)", message: PRESENTATION_MESSAGE },
	{ regex: "(^|/)prisma/", message: PRESENTATION_MESSAGE },
];

const PRISMA_BASE_PATTERN = { regex: "platform/infrastructure/persistence/prisma-base", message: PRISMA_BASE_MESSAGE };

const COMMAND_BUS_PATHS = [{ name: "@nestjs/cqrs", importNames: ["CommandBus"], message: SYSTEM_COMMAND_MESSAGE }];

const ARCHITECTURE_BASE_PATTERNS = [...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...BACKEND_RESTRICTED_IMPORT_PATTERNS];

function otherContextNames(contextName) {
	return DDD_CONTEXTS.filter((name) => name !== contextName).join("|");
}

function crossContextPatterns(contextName) {
	const others = otherContextNames(contextName);
	return [
		{ regex: `(\\.\\./)+(${others})/${LAYER_SEGMENT}(/|$)`, message: PUBLIC_API_MESSAGE },
		{ regex: `(^|/)contexts/(${others})/${LAYER_SEGMENT}(/|$)`, message: PUBLIC_API_MESSAGE },
	];
}

function restrictedImports(patterns, paths) {
	return {
		"workspace/restricted-imports": ["error", { patterns: [...ARCHITECTURE_BASE_PATTERNS, ...patterns], ...(paths === undefined ? {} : { paths }) }],
	};
}

function architectureBlock(files, patterns, paths) {
	return { files, rules: restrictedImports(patterns, paths) };
}

/** Layer rules for `apps/api/src/contexts` and `apps/api/src/platform`. A later block replaces `workspace/restricted-imports`, so each block repeats the universal and backend patterns. */
export const apiArchitectureBoundaryConfigs = [
	...DDD_CONTEXTS.flatMap((contextName) => {
		const cross = crossContextPatterns(contextName);
		return [
			architectureBlock([`src/contexts/${contextName}/**`], cross),
			architectureBlock([`src/contexts/${contextName}/presentation/**`], [...PRESENTATION_LAYER_PATTERNS, ...cross]),
			architectureBlock([`src/contexts/${contextName}/presentation/{jobs,cli}/**`], [...PRESENTATION_LAYER_PATTERNS, ...cross], COMMAND_BUS_PATHS),
			architectureBlock([`src/contexts/${contextName}/application/**`], [...APPLICATION_LAYER_PATTERNS, PRISMA_BASE_PATTERN, ...cross]),
			architectureBlock([`src/contexts/${contextName}/domain/**`], [...DOMAIN_LAYER_PATTERNS, PRISMA_BASE_PATTERN, ...cross]),
		];
	}),
	architectureBlock(
		["src/platform/infrastructure/**", "src/platform/presentation/**"],
		[{ regex: `(^|/)contexts/[^/]+/${LAYER_SEGMENT}/`, message: PLATFORM_PUBLIC_API_MESSAGE }],
	),
	architectureBlock(["src/platform/application/**"], [...APPLICATION_LAYER_PATTERNS, PRISMA_BASE_PATTERN, { regex: "(^|/)contexts/", message: PLATFORM_NO_CONTEXTS_MESSAGE }]),
	architectureBlock(["src/platform/domain/**"], [...DOMAIN_LAYER_PATTERNS, PRISMA_BASE_PATTERN]),
	{
		files: ["src/modules/**/*.ts"],
		rules: {
			"workspace/restricted-syntax": ["error", { selector: "Program", message: "modules/ was retired by the DDD migration; use contexts/." }],
		},
	},
];

/** Frontend block: universal + browser-safety patterns, plus the client-component rule. */
export const frontendImportBoundaryConfig = {
	files: LINTED_SOURCE_FILES,
	rules: {
		"workspace/restricted-imports": ["error", { patterns: [...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...FRONTEND_RESTRICTED_IMPORT_PATTERNS] }],
		"workspace/no-server-import-in-client-component": "error",
	},
};

// ── Frontend contexts (plan §12.2) ───────────────────────────────────────────
// Web apps, packages/client and the mobile app group domain code by the same
// context names as the API (`contexts/<context>/`). Routes, feature stores and
// generic lib code may import any context file; one context may import
// ANOTHER context only through that context's index barrel. A context's own
// files import each other freely. One block per context, because the allowed
// set depends on which context the importing file belongs to.

const FRONTEND_CONTEXT_MESSAGE = "Import another frontend context only through its index (DDD migration §12.2).";

/** A file of another context other than its index: by an alias/package path (`…/contexts/<b>/x`) or relatively (`../../<b>/x`). */
function frontendCrossContextPatterns(contextName) {
	const others = otherContextNames(contextName);
	const notIndex = "(?!index(?:\\.tsx?)?$).+";
	return [
		{ regex: `(^|/)contexts/(${others})/${notIndex}`, message: FRONTEND_CONTEXT_MESSAGE },
		{ regex: `^(\\.\\./)+(${others})/${notIndex}`, message: FRONTEND_CONTEXT_MESSAGE },
	];
}

function frontendContextFiles(contextName) {
	return LINTED_SOURCE_FILES.map((glob) => `**/contexts/${contextName}/${glob}`);
}

/** Per-context blocks for browser code (Next apps, packages/client, packages/ui). Each repeats the universal and frontend patterns, since a later block replaces `workspace/restricted-imports`. */
export const frontendContextBoundaryConfigs = DDD_CONTEXTS.map((contextName) => ({
	files: frontendContextFiles(contextName),
	rules: {
		"workspace/restricted-imports": [
			"error",
			{ patterns: [...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...FRONTEND_RESTRICTED_IMPORT_PATTERNS, ...frontendCrossContextPatterns(contextName)] },
		],
	},
}));

/** Per-context blocks for apps/mobile: the mobile patterns plus the same context rule. */
export const mobileContextBoundaryConfigs = DDD_CONTEXTS.map((contextName) => ({
	files: frontendContextFiles(contextName),
	rules: {
		"workspace/restricted-imports": [
			"error",
			{
				patterns: [
					...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS,
					...FRONTEND_RESTRICTED_IMPORT_PATTERNS,
					...MOBILE_RESTRICTED_IMPORT_PATTERNS,
					...frontendCrossContextPatterns(contextName),
				],
			},
		],
	},
}));
