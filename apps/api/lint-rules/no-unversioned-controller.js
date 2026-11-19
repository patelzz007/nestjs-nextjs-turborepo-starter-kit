// ============================================
// lint-rules/no-unversioned-controller.js
// ============================================
// Custom rule: a business controller is an `@ApiController(path)` (ADR 094), which serves it at every API
// version's literal path (`/api/v1/…`, `/api/v2/…`). A plain `@Controller` serves its path as written, outside
// every version, so the apps (whose transport prepends `/api/<version>`) could never reach it — the `/session`
// 404 regression. Only the unversioned routes keep `@Controller`: the root, health, the version manifest and
// the Resend webhook.
//
// Plain JavaScript on purpose: oxlint loads it as an ESLint-API JS plugin (lint-rules/index.js), and a rule
// needs nothing beyond the AST — node kinds are compared as plain strings.

// Mirrors UNVERSIONED_ROUTE_PREFIXES in @workspace/shared/contracts (the source of truth), pre-normalized.
const UNVERSIONED_PREFIXES = new Set(["", "health", "notifications/email-webhook", "version"]);

// Strips a leading "/" so `@Controller("/health")` and `@Controller("health")` compare equally.
function normalizePath(value) {
	return value.startsWith("/") ? value.slice(1) : value;
}

export const noUnversionedController = {
	name: "no-unversioned-controller",
	meta: {
		type: "problem",
		docs: {
			description: "Business controllers are @ApiController(path); @Controller is only for the unversioned routes",
			recommended: "error",
		},
		messages: {
			useApiController:
				"A business controller is @ApiController(path) (ADR 094), which serves it under every /api/<version>. @Controller is only for the unversioned routes (root, health, version, the email webhook).",
		},
		schema: [],
	},
	defaultOptions: [],
	create(context) {
		return {
			Decorator(node) {
				if (node.expression.type !== "CallExpression") return;
				const callee = node.expression.callee;
				if (callee.type !== "Identifier" || callee.name !== "Controller") return;

				const first = node.expression.arguments[0];
				// Bare @Controller() — the root.
				if (first === undefined) return;

				if (first.type === "Literal" && typeof first.value === "string" && UNVERSIONED_PREFIXES.has(normalizePath(first.value))) return;

				context.report({ node: first, messageId: "useApiController" });
			},
		};
	},
};
