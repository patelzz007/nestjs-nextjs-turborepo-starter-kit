// ============================================
// eslint-rules/no-unversioned-controller.js
// ============================================
// Custom rule: business controllers must build their path with `apiPath()`
// from `@workspace/shared` so routes serve under the versioned prefix
// (`/api/v1/...`). The client transport prepends the SAME prefix, so a
// controller that forgets the helper silently serves a path the apps can
// never reach — exactly the `/session` 404 regression. Unversioned routes
// are explicitly allowlisted (root, health, the Resend webhook, and the
// version manifest).
//
// Plain JavaScript on purpose: ESLint loads its config (and anything the
// config imports) as ESM JavaScript — TypeScript syntax would crash it, and
// a rule file must not import @typescript-eslint/utils (not a direct dep of
// this package under pnpm's strict resolution). AST node kinds are compared
// as plain strings, which is all a rule needs.

// Mirrors UNVERSIONED_ROUTE_PREFIXES in @workspace/shared/contracts. Keep in
// sync — the shared constant is the source of truth; this is a fast-path copy
// for the lint check (the values here are the same list, pre-normalized).
const UNVERSIONED_PREFIXES = new Set(["", "health", "notifications/email-webhook", "version"]);

// Strips a leading "/" so `@Controller("/health")` and `@Controller("health")`
// compare equally.
function normalizePath(value) {
	return value.startsWith("/") ? value.slice(1) : value;
}

export const noUnversionedController = {
	name: "no-unversioned-controller",
	meta: {
		type: "problem",
		docs: {
			description: "Business controllers must build their path with apiPath() so routes live under the versioned prefix",
			recommended: "error",
		},
		messages: {
			unversioned:
				'Controller path "{{ path }}" is unversioned — the client transport prepends `/api/v1`, so this route is unreachable from the apps. Use apiPath("/{{ path }}") to serve it under the versioned prefix.',
			nonLiteral:
				"Controller path must be a plain string literal or apiPath(...) — build it with apiPath() from @workspace/shared so it stays under the versioned prefix.",
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
				// Bare @Controller() — root-level controllers (welcome `/`,
				// `/health`, legacy `POST /users`) are explicitly allowlisted.
				if (first === undefined) return;

				// @Controller(apiPath("/auth")) — versioned via the helper.
				if (first.type === "CallExpression") {
					const called = first.callee;
					if (called.type === "Identifier" && called.name === "apiPath") return;
				}

				// @Controller("some/string") — allow only the unversioned allowlist.
				if (first.type === "Literal" && typeof first.value === "string") {
					if (!UNVERSIONED_PREFIXES.has(normalizePath(first.value))) {
						context.report({ node: first, messageId: "unversioned", data: { path: first.value } });
					}
					return;
				}

				// Template literals, concatenations, dynamic paths — can't prove
				// versioning, so require the helper explicitly.
				context.report({ node: first, messageId: "nonLiteral" });
			},
		};
	},
};
