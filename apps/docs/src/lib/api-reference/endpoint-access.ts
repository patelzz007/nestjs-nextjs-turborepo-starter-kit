/**
 * Who may call each endpoint, read from the API's controller decorators.
 *
 * The OpenAPI export says whether a route is public, but not which permission,
 * policy, guard or rate limit protects it. Those live in decorators on the
 * controller methods (`@RequirePermission("READ", "GEO")`, `@SuperAdminOnly()`,
 * `@UseGuards(MerchantApiKeyGuard, …)`, …). This module reads the controller
 * SOURCE (pure: it receives file contents, never touches the disk) and keys
 * every method by its OpenAPI operation id, `${ControllerClass}_${method}`, so
 * the reference cannot drift from the code that enforces it.
 */

/** What protects one endpoint (class-level decorators merged with the method's own). */
export interface EndpointAccess {
	readonly sourceFile: string;
	readonly isPublic: boolean;
	/** `MerchantApiKeyGuard`: authenticated by a merchant API key, never a cookie. */
	readonly merchantApiKey: boolean;
	/** `RefreshTokenGuard` / `OptionalRefreshTokenGuard`: reads the refresh-token cookie. */
	readonly refreshToken: boolean;
	/** `@AllowApiKeyAuth()`: an INTEGRATION-scope API key may call it too. */
	readonly allowsIntegrationKey: boolean;
	readonly superAdminOnly: boolean;
	readonly adminAccessOnly: boolean;
	/** `ACTION:RESOURCE` pairs from `@RequirePermission`. */
	readonly permissions: readonly string[];
	/** `@Authorize` policies: `ACTION:RESOURCE` plus the policy's own description. */
	readonly policies: readonly string[];
	readonly emailVerified: boolean;
	readonly fullSession: boolean;
	/** `@RlsBypass()`: runs as an allow-listed system operation. */
	readonly rlsBypass: boolean;
	readonly idempotent: boolean;
	/** `@SkipMutationIntent()`: no `X-Mutation-Intent` header needed (machine callers). */
	readonly skipsMutationIntent: boolean;
	/** Rate limits declared on the route, human-readable. */
	readonly throttles: readonly string[];
}

/** A controller file: its repository-relative path and its source text. */
export interface ControllerSource {
	readonly path: string;
	readonly source: string;
}

interface DecoratorSet {
	readonly decorators: readonly string[];
}

const CLASS_PATTERN = /^(?:export\s+)?class\s+(?<name>\w+)/;
const METHOD_PATTERN = /^\s+(?:public\s+)?(?:async\s+)?(?<name>\w+)\s*\(/;
const STRING_ARGUMENT_PATTERN = /"(?<value>[^"]*)"/g;
const ACTION_ARGUMENT_PATTERN = /action:\s*"(?<action>\w+)"/;
const RESOURCE_ARGUMENT_PATTERN = /resource:\s*"(?<resource>\w+)"/;
const DESCRIPTION_ARGUMENT_PATTERN = /description:\s*"(?<description>[^"]*)"/;
const DECORATOR_START = /^\s*@\w+/;
const MS_PER_SECOND = 1000;

/** Collapses a (possibly multi-line) decorator to one line. */
function normalize(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function parenthesisBalance(text: string): number {
	let balance = 0;
	for (const character of text) {
		if (character === "(") balance += 1;
		if (character === ")") balance -= 1;
	}
	return balance;
}

/** Splits a controller file into class names, each with its class decorators and its methods' decorators. */
function scanControllers(source: string): Map<string, { readonly classDecorators: readonly string[]; readonly methods: Map<string, DecoratorSet> }> {
	const classes = new Map<string, { readonly classDecorators: readonly string[]; readonly methods: Map<string, DecoratorSet> }>();
	const lines = source.split("\n");
	let pending: string[] = [];
	let current: { readonly methods: Map<string, DecoratorSet> } | undefined;
	let index = 0;
	while (index < lines.length) {
		const line = lines[index] ?? "";
		if (DECORATOR_START.test(line)) {
			let text = line;
			while (parenthesisBalance(text) > 0 && index + 1 < lines.length) {
				index += 1;
				text += `\n${lines[index] ?? ""}`;
			}
			pending.push(normalize(text));
			index += 1;
			continue;
		}
		const className = CLASS_PATTERN.exec(line)?.groups?.name;
		if (className !== undefined) {
			const methods = new Map<string, DecoratorSet>();
			classes.set(className, { classDecorators: pending, methods });
			current = { methods };
			pending = [];
			index += 1;
			continue;
		}
		const methodName = METHOD_PATTERN.exec(line)?.groups?.name;
		if (methodName !== undefined && current !== undefined && pending.length > 0 && methodName !== "constructor") {
			current.methods.set(methodName, { decorators: pending });
			pending = [];
		}
		index += 1;
	}
	return classes;
}

function stringArguments(decorator: string): readonly string[] {
	return [...decorator.matchAll(STRING_ARGUMENT_PATTERN)].map((match) => match.groups?.value ?? "");
}

/** A config-driven limit or window, shown by the environment variable that sets it. */
const CONFIG_EXPRESSIONS: ReadonlyMap<string, string> = new Map([
	["getApiConfig().rateLimits.throttleDefaultLimit", "`THROTTLE_DEFAULT_LIMIT`"],
	["getApiConfig().email.webhookRateLimitPerMinute", "`WEBHOOK_RATE_LIMIT_PER_MINUTE`"],
]);
/** A policy without its own window uses `windowMs()`, the configured throttler window. */
const DEFAULT_WINDOW = "`THROTTLE_TTL_MS` ms";
const NUMERIC_CONSTANT_PATTERN = /^(?:export\s+)?const\s+(?<name>[A-Z][A-Z0-9_]*)\s*=\s*(?<value>[\d_]+);/gm;
const ALIAS_CONSTANT_PATTERN = /^(?:export\s+)?const\s+(?<name>[A-Z][A-Z0-9_]*)\s*=\s*(?<target>[A-Z][A-Z0-9_]*);/gm;
const POLICY_GETTER_PATTERN =
	/get\s+(?<key>\w+)\(\)[^{]*\{[^}]*?return\s+policy\(\s*"[^"]*",\s*"(?<throttler>\w+)",\s*"(?<tracker>\w+)",\s*(?<limit>[\w.]+(?:\(\)[\w.]*)*)(?:,\s*(?<window>[\w.]+(?:\(\)[\w.]*)*))?\s*\);/g;

/**
 * The human-readable rule of every named policy (`RATE_LIMIT_POLICY.<key>`), read from the SOURCE of
 * `rate-limit-policy.ts`: its throttler, tracker, limit and window, with named constants resolved and
 * config-driven values shown by their environment variable — so the reference follows the code.
 */
export function extractRateLimitPolicies(policySource: string): ReadonlyMap<string, string> {
	const constants = new Map<string, number>();
	for (const match of policySource.matchAll(NUMERIC_CONSTANT_PATTERN)) {
		constants.set(match.groups?.name ?? "", Number((match.groups?.value ?? "").replaceAll("_", "")));
	}
	for (const match of policySource.matchAll(ALIAS_CONSTANT_PATTERN)) {
		const value = constants.get(match.groups?.target ?? "");
		if (value !== undefined) {
			constants.set(match.groups?.name ?? "", value);
		}
	}
	const describeValue = (expression: string): string => {
		const trimmed = expression.trim();
		const constant = constants.get(trimmed);
		return constant === undefined ? (CONFIG_EXPRESSIONS.get(trimmed) ?? `\`${trimmed}\``) : String(constant);
	};
	const policies = new Map<string, string>();
	for (const match of policySource.matchAll(POLICY_GETTER_PATTERN)) {
		const groups = match.groups ?? {};
		const windowExpression = groups.window;
		const windowMs = windowExpression === undefined ? undefined : constants.get(windowExpression.trim());
		const window =
			windowExpression === undefined ? DEFAULT_WINDOW : windowMs === undefined ? `${describeValue(windowExpression)} ms` : `${String(windowMs / MS_PER_SECOND)} s`;
		const who = groups.tracker === "principal" ? "signed-in principal" : "client IP";
		policies.set(groups.key ?? "", `${describeValue(groups.limit ?? "")} requests per ${window} per ${who} (${groups.throttler ?? ""} limiter)`);
	}
	return policies;
}

function describeNamedPolicy(decorator: string, policies: ReadonlyMap<string, string>): string | null {
	const name = /@RateLimit\(RATE_LIMIT_POLICY\.(?<name>\w+)\)/.exec(decorator)?.groups?.name;
	return name === undefined ? null : (policies.get(name) ?? null);
}

/** `{ strict: { ttl: 60000, limit: 5 } }` → "5 per 60 s per client IP (strict limiter)". */
function describeThrottle(decorator: string): readonly string[] {
	const limits: string[] = [];
	for (const match of decorator.matchAll(/(\w+):\s*\{\s*ttl:\s*([\w.]+),\s*limit:\s*([\w.]+)\s*\}/g)) {
		const [, name = "", ttl = "", limit = ""] = match;
		const ttlMs = Number(ttl);
		const window = Number.isInteger(ttlMs) ? `${String(ttlMs / MS_PER_SECOND)} s` : `\`${ttl}\` ms`;
		const count = Number.isInteger(Number(limit)) ? limit : `\`${limit}\``;
		limits.push(`${count} requests per ${window} per client IP (${name} limiter)`);
	}
	return limits;
}

function has(decorators: readonly string[], name: string): boolean {
	return decorators.some((decorator) => decorator.startsWith(`@${name}(`));
}

function toAccess(sourceFile: string, decorators: readonly string[], rateLimitPolicies: ReadonlyMap<string, string>): EndpointAccess {
	const guards = decorators.filter((decorator) => decorator.startsWith("@UseGuards(")).join(" ");
	const permissions = decorators
		.filter((decorator) => decorator.startsWith("@RequirePermission("))
		.map((decorator) => stringArguments(decorator))
		.map(([action = "", resource = ""]) => `${action}:${resource}`);
	const policies = decorators
		.filter((decorator) => decorator.startsWith("@Authorize("))
		.map((decorator) => {
			const action = ACTION_ARGUMENT_PATTERN.exec(decorator)?.groups?.action ?? "?";
			const resource = RESOURCE_ARGUMENT_PATTERN.exec(decorator)?.groups?.resource ?? "?";
			const description = DESCRIPTION_ARGUMENT_PATTERN.exec(decorator)?.groups?.description;
			const self = /resourceId:\s*self\(\)/.test(decorator) ? " (own record only)" : "";
			return `${action}:${resource}${self}${description === undefined ? "" : ` — ${description}`}`;
		});
	return {
		sourceFile,
		isPublic: has(decorators, "Public"),
		merchantApiKey: guards.includes("MerchantApiKeyGuard"),
		refreshToken: /\b(Optional)?RefreshTokenGuard\b/.test(guards),
		allowsIntegrationKey: has(decorators, "AllowApiKeyAuth"),
		superAdminOnly: has(decorators, "SuperAdminOnly"),
		adminAccessOnly: has(decorators, "AdminAccessOnly"),
		permissions,
		policies,
		emailVerified: has(decorators, "EmailVerified"),
		fullSession: has(decorators, "RequiresFullSession"),
		rlsBypass: has(decorators, "RlsBypass"),
		idempotent: has(decorators, "Idempotent"),
		skipsMutationIntent: has(decorators, "SkipMutationIntent"),
		throttles: decorators.flatMap((decorator): readonly string[] => {
			if (decorator.startsWith("@Throttle(")) {
				return describeThrottle(decorator);
			}
			const named: string | null = decorator.startsWith("@RateLimit(") ? describeNamedPolicy(decorator, rateLimitPolicies) : null;
			return named === null ? [] : [named];
		}),
	};
}

/**
 * Access rules of every controller method, keyed by OpenAPI operation id (`Controller_method`).
 * `policySource` is the text of `rate-limit-policy.ts`, which defines the named `@RateLimit` policies.
 */
export function extractEndpointAccess(files: readonly ControllerSource[], policySource: string): ReadonlyMap<string, EndpointAccess> {
	const rateLimitPolicies = extractRateLimitPolicies(policySource);
	const access = new Map<string, EndpointAccess>();
	for (const file of files) {
		for (const [className, scanned] of scanControllers(file.source)) {
			for (const [methodName, method] of scanned.methods) {
				access.set(`${className}_${methodName}`, toAccess(file.path, [...scanned.classDecorators, ...method.decorators], rateLimitPolicies));
			}
		}
	}
	return access;
}
