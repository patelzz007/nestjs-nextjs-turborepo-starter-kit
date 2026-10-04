// ============================================
// runtime/app-env.ts - Env building blocks for every app
// ============================================
// Every deployable app validates its environment ONCE, through a zod schema
// composed from the building blocks below, and parses it with
// `parseEnvOrThrow` — so every app fails fast with the same readable,
// value-free error.
//
//   Next apps (web / admin / merchant) → lib/env/env.{client,server}.ts
//                                        (docs/technical/configuration/frontend.md)
//   apps/api                           → src/config/api-config.ts
//                                        (docs/technical/configuration/api.md)
//   apps/analytics-consumer            → src/env.ts
//
// This file is framework-agnostic: it never touches `process.env` itself —
// the app env modules build the source record and hand it in.

import { z } from "zod";

// ── Field schemas ──────────────────────────────────────────────────────────

/** The runtime modes Next.js and Vitest set `NODE_ENV` to. */
export const NodeEnvSchema = z.enum(["development", "test", "production"]);
export type NodeEnv = z.output<typeof NodeEnvSchema>;

const HTTP_PROTOCOL_PATTERN = /^https?$/;
const TRAILING_SLASHES_PATTERN = /\/+$/;

/**
 * Absolute `http(s)://` URL. Trailing slashes are stripped so callers can
 * safely build `${url}/path` without producing `//path`.
 */
export const HttpUrlEnvSchema = z
	.url({ protocol: HTTP_PROTOCOL_PATTERN, error: "must be an absolute http:// or https:// URL" })
	.transform((value: string): string => value.replace(TRAILING_SLASHES_PATTERN, ""));

/** `"true"` / `"false"` switch. Unset means off — features are opt-in. */
export const BooleanFlagEnvSchema = z
	.enum(["true", "false"], { error: 'must be "true" or "false"' })
	.default("false")
	.transform((value: "true" | "false"): boolean => value === "true");

const WHOLE_NUMBER_PATTERN = /^\d+$/;

/**
 * Optional interval in milliseconds. Unset or `0` disables the behaviour
 * (resolves to `null`); any positive whole number enables it.
 */
export const OptionalIntervalMsEnvSchema = z
	.string()
	.trim()
	.regex(WHOLE_NUMBER_PATTERN, "must be a whole number of milliseconds (unset or 0 disables it)")
	.optional()
	.transform((value: string | undefined): number | null => {
		if (value === undefined) return null;
		const intervalMs = Number(value);
		return intervalMs === 0 ? null : intervalMs;
	});

const COOKIE_DOMAIN_PATTERN = /^\.?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i;

/** Cookie `Domain` attribute: a bare host such as `localhost` or `.example.com`. */
export const CookieDomainEnvSchema = z.string().regex(COOKIE_DOMAIN_PATTERN, "must be a bare host name such as localhost or .example.com (no scheme, port or path)");

/** Bounds for a whole-number env var (inclusive). */
export interface IntegerEnvBounds {
	readonly min: number;
	readonly max?: number;
}

/** A whole-number env var with a documented default used when it is unset. */
export interface IntegerEnvOptions extends IntegerEnvBounds {
	readonly defaultValue: number;
}

function boundedIntegerSchema(bounds: IntegerEnvBounds): z.ZodNumber {
	const withMin: z.ZodNumber = z
		.number()
		.int()
		.min(bounds.min, `must be at least ${String(bounds.min)}`);
	return bounds.max === undefined ? withMin : withMin.max(bounds.max, `must be at most ${String(bounds.max)}`);
}

const WholeNumberStringSchema = z.string().trim().regex(WHOLE_NUMBER_PATTERN, "must be a whole number");

/**
 * Whole number within `[min, max]` (`"300"` → `300`). Unset resolves to
 * `defaultValue`; anything else that is not a whole number in range fails
 * fast instead of silently falling back to the default.
 */
export function integerEnvSchema(options: IntegerEnvOptions): z.ZodType<number, string | undefined> {
	return WholeNumberStringSchema.default(String(options.defaultValue))
		.transform((value: string): number => Number(value))
		.pipe(boundedIntegerSchema(options));
}

/** Like {@link integerEnvSchema}, but unset stays `undefined` (the caller derives the default). */
export function optionalIntegerEnvSchema(bounds: IntegerEnvBounds): z.ZodType<number | undefined, string | undefined> {
	return WholeNumberStringSchema.transform((value: string): number => Number(value))
		.pipe(boundedIntegerSchema(bounds))
		.optional();
}

const LIST_SEPARATOR = ",";

/**
 * Comma-separated list (`"a, b,c"` → `["a", "b", "c"]`). Blank entries are
 * dropped, every entry is validated by `item`, and at least one is required.
 */
export function commaSeparatedEnvSchema(item: z.ZodType<string, string>): z.ZodType<string[], string> {
	return z
		.string()
		.transform((raw: string): string[] =>
			raw
				.split(LIST_SEPARATOR)
				.map((entry: string): string => entry.trim())
				.filter((entry: string): boolean => entry.length > 0),
		)
		.pipe(z.array(item).min(1, "must list at least one comma-separated value"));
}

const POSTGRES_PROTOCOL_PATTERN = /^postgres(ql)?$/;

/** `postgres://` / `postgresql://` connection string (credentials are never echoed on failure). */
export const PostgresUrlEnvSchema = z.url({ protocol: POSTGRES_PROTOCOL_PATTERN, error: "must be a postgres:// or postgresql:// connection URL" });

const KAFKA_BROKER_PATTERN = /^[A-Za-z0-9.-]+:\d{1,5}$/;

/** One Kafka bootstrap server, `host:port`. */
export const KafkaBrokerEnvSchema = z.string().regex(KAFKA_BROKER_PATTERN, "every broker must be host:port");

/** `KAFKA_BROKERS`: comma-separated `host:port` bootstrap servers (at least one). */
export const KafkaBrokersEnvSchema = commaSeparatedEnvSchema(KafkaBrokerEnvSchema);

// ── Composite schemas ──────────────────────────────────────────────────────

/**
 * Server-only variables every Next app reads (proxy cookie clearing, secure
 * cookie flag). Apps extend this with `.extend({...})` when they need more.
 */
export const NextAppServerEnvSchema = z.strictObject({
	NODE_ENV: NodeEnvSchema,
	COOKIE_DOMAIN: CookieDomainEnvSchema.optional(),
});
export type NextAppServerEnv = z.output<typeof NextAppServerEnvSchema>;

/** Prefix Next.js requires before it inlines a variable into the browser bundle. */
export const PUBLIC_ENV_PREFIX = "NEXT_PUBLIC_";

/** A variable name Next.js will expose to the browser. */
export type PublicEnvKey = `NEXT_PUBLIC_${string}`;

/** Thrown when a public env schema declares a key Next.js would never inline. */
export class NonPublicEnvKeyError extends Error {
	public readonly keys: readonly string[];

	public constructor(keys: readonly string[]) {
		super(`Public env schemas may only declare ${PUBLIC_ENV_PREFIX}* keys; found: ${keys.join(", ")}`);
		this.name = "NonPublicEnvKeyError";
		this.keys = keys;
	}
}

/**
 * Compile-time guard for public env shapes: every `NEXT_PUBLIC_*` key maps to
 * a schema, any other key maps to an explanatory string type — so declaring
 * e.g. `DATABASE_URL` fails to compile with that message.
 */
export type PublicEnvShape<TShape> = {
	readonly [TKey in keyof TShape]: TKey extends PublicEnvKey ? z.ZodType : `${TKey & string} is not a NEXT_PUBLIC_* variable and cannot be public config`;
};

/**
 * Builds the schema for an app's `env.client.ts`. Only `NEXT_PUBLIC_*` keys
 * compile, and the keys are re-checked at runtime, so a server secret can
 * never be declared as "public" config.
 */
export function createPublicEnvSchema<TShape extends Record<string, z.ZodType> & PublicEnvShape<TShape>>(shape: TShape): z.ZodObject<TShape, z.core.$strict> {
	const nonPublicKeys: string[] = Object.keys(shape).filter((key: string): boolean => !key.startsWith(PUBLIC_ENV_PREFIX));
	if (nonPublicKeys.length > 0) {
		throw new NonPublicEnvKeyError(nonPublicKeys);
	}
	return z.strictObject(shape);
}

// ── Parsing ────────────────────────────────────────────────────────────────

/** Raw variables as they arrive from `process.env`. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** One invalid variable. Never carries the variable's value. */
export interface EnvIssue {
	readonly variable: string;
	readonly problem: string;
}

/** Placeholder written in place of a value that leaked into an error message. */
export const REDACTED_ENV_VALUE = "[redacted]";

/**
 * Values shorter than this are not scrubbed from messages: they would match
 * ordinary words ("true", "1") and garble the explanation, and a value that
 * short is not a credential.
 */
const MIN_REDACTABLE_VALUE_LENGTH = 6;

/** Fail-fast error listing every invalid variable by name — values are never included. */
export class EnvValidationError extends Error {
	public readonly scope: string;
	public readonly issues: readonly EnvIssue[];

	public constructor(scope: string, issues: readonly EnvIssue[]) {
		super(formatEnvIssues(scope, issues));
		this.name = "EnvValidationError";
		this.scope = scope;
		this.issues = issues;
	}

	/** Distinct names of the variables that failed validation. */
	public get variables(): readonly string[] {
		return [...new Set(this.issues.map((issue: EnvIssue): string => issue.variable))];
	}
}

/** Renders the multi-line fail-fast message shown at startup / build time. */
export function formatEnvIssues(scope: string, issues: readonly EnvIssue[]): string {
	const lines: string[] = issues.map((issue: EnvIssue): string => `  - ${issue.variable}: ${issue.problem}`);
	return [`Invalid environment configuration for ${scope}:`, ...lines, "Set these variables (see the app's .env.example). Values are never printed."].join("\n");
}

/**
 * Treats empty or whitespace-only values as unset, so `FOO=` in a `.env` file
 * behaves exactly like leaving `FOO` out.
 */
export function normalizeEnvSource(source: EnvSource): Record<string, string | undefined> {
	return Object.fromEntries(
		Object.entries(source).map(([key, value]: [string, string | undefined]): [string, string | undefined] => [
			key,
			value === undefined || value.trim() === "" ? undefined : value,
		]),
	);
}

function redactValue(message: string, value: string | undefined): string {
	if (value === undefined || value.length < MIN_REDACTABLE_VALUE_LENGTH) return message;
	return message.split(value).join(REDACTED_ENV_VALUE);
}

function toEnvIssues(issue: z.core.$ZodIssue, source: Readonly<Record<string, string | undefined>>): EnvIssue[] {
	if (issue.code === "unrecognized_keys") {
		return issue.keys.map((key: string): EnvIssue => ({ variable: key, problem: "is not declared in this env schema" }));
	}
	const variable: string = issue.path.length === 0 ? "(env)" : issue.path.map(String).join(".");
	const rootKey: string = issue.path.length === 0 ? "" : String(issue.path[0]);
	const rawValue: string | undefined = source[rootKey];
	if (rawValue === undefined) {
		// A cross-field rule (`superRefine`) explains a conditional requirement
		// ("is required when EMAIL_MODE=send"); keep that explanation.
		return [{ variable, problem: issue.code === "custom" ? issue.message : "is required but not set" }];
	}
	return [{ variable, problem: redactValue(issue.message, rawValue) }];
}

/**
 * Parses an env source against a schema, or throws an `EnvValidationError`
 * that names every invalid variable (and why) without echoing any value.
 *
 * @param scope human-readable owner, e.g. `"apps/web (server)"`.
 */
export function parseEnvOrThrow<TSchema extends z.ZodType>(schema: TSchema, source: EnvSource, scope: string): z.output<TSchema> {
	const normalized: Record<string, string | undefined> = normalizeEnvSource(source);
	const result = schema.safeParse(normalized);
	if (result.success) {
		return result.data;
	}
	throw new EnvValidationError(
		scope,
		result.error.issues.flatMap((issue: z.core.$ZodIssue): EnvIssue[] => toEnvIssues(issue, normalized)),
	);
}
