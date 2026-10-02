import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	BooleanFlagEnvSchema,
	commaSeparatedEnvSchema,
	CookieDomainEnvSchema,
	createPublicEnvSchema,
	EnvValidationError,
	formatEnvIssues,
	HttpUrlEnvSchema,
	integerEnvSchema,
	KafkaBrokersEnvSchema,
	NextAppServerEnvSchema,
	NodeEnvSchema,
	NonPublicEnvKeyError,
	normalizeEnvSource,
	optionalIntegerEnvSchema,
	OptionalIntervalMsEnvSchema,
	parseEnvOrThrow,
	PostgresUrlEnvSchema,
	PUBLIC_ENV_PREFIX,
	REDACTED_ENV_VALUE,
} from "./app-env";

const SCOPE = "apps/test (server)";

function captureEnvError(run: () => void): EnvValidationError {
	try {
		run();
	} catch (error) {
		if (error instanceof EnvValidationError) {
			return error;
		}
		throw error;
	}
	throw new Error("expected an EnvValidationError to be thrown");
}

describe("NodeEnvSchema", () => {
	it("accepts the three runtime modes", () => {
		expect(NodeEnvSchema.parse("development")).toBe("development");
		expect(NodeEnvSchema.parse("test")).toBe("test");
		expect(NodeEnvSchema.parse("production")).toBe("production");
	});

	it("rejects anything else", () => {
		expect(NodeEnvSchema.safeParse("staging").success).toBe(false);
	});
});

describe("HttpUrlEnvSchema", () => {
	it("accepts http and https URLs", () => {
		expect(HttpUrlEnvSchema.parse("http://localhost:8080")).toBe("http://localhost:8080");
		expect(HttpUrlEnvSchema.parse("https://api.example.com")).toBe("https://api.example.com");
	});

	it("strips trailing slashes so `${url}/path` never doubles the slash", () => {
		expect(HttpUrlEnvSchema.parse("https://app.example.com/")).toBe("https://app.example.com");
		expect(HttpUrlEnvSchema.parse("https://app.example.com/base//")).toBe("https://app.example.com/base");
	});

	it("rejects relative paths, bare hosts and non-http schemes", () => {
		expect(HttpUrlEnvSchema.safeParse("/api").success).toBe(false);
		expect(HttpUrlEnvSchema.safeParse("localhost:8080").success).toBe(false);
		expect(HttpUrlEnvSchema.safeParse("ftp://files.example.com").success).toBe(false);
		expect(HttpUrlEnvSchema.safeParse("javascript:alert(1)").success).toBe(false);
	});
});

describe("BooleanFlagEnvSchema", () => {
	it("defaults to false when unset", () => {
		expect(BooleanFlagEnvSchema.parse(undefined)).toBe(false);
	});

	it("maps the two literal strings to booleans", () => {
		expect(BooleanFlagEnvSchema.parse("true")).toBe(true);
		expect(BooleanFlagEnvSchema.parse("false")).toBe(false);
	});

	it("rejects other truthy-looking spellings instead of guessing", () => {
		expect(BooleanFlagEnvSchema.safeParse("1").success).toBe(false);
		expect(BooleanFlagEnvSchema.safeParse("TRUE").success).toBe(false);
		expect(BooleanFlagEnvSchema.safeParse("yes").success).toBe(false);
	});
});

describe("OptionalIntervalMsEnvSchema", () => {
	it("resolves unset and 0 to null (disabled)", () => {
		expect(OptionalIntervalMsEnvSchema.parse(undefined)).toBeNull();
		expect(OptionalIntervalMsEnvSchema.parse("0")).toBeNull();
	});

	it("parses a positive whole number of milliseconds, trimming whitespace", () => {
		expect(OptionalIntervalMsEnvSchema.parse("60000")).toBe(60_000);
		expect(OptionalIntervalMsEnvSchema.parse(" 300000 ")).toBe(300_000);
	});

	it("rejects negatives, fractions and garbage (fail fast, not silently disabled)", () => {
		expect(OptionalIntervalMsEnvSchema.safeParse("-5").success).toBe(false);
		expect(OptionalIntervalMsEnvSchema.safeParse("1.5").success).toBe(false);
		expect(OptionalIntervalMsEnvSchema.safeParse("abc").success).toBe(false);
		expect(OptionalIntervalMsEnvSchema.safeParse("NaN").success).toBe(false);
	});
});

describe("CookieDomainEnvSchema", () => {
	it("accepts bare hosts with an optional leading dot", () => {
		expect(CookieDomainEnvSchema.parse("localhost")).toBe("localhost");
		expect(CookieDomainEnvSchema.parse(".example.com")).toBe(".example.com");
		expect(CookieDomainEnvSchema.parse("app.example.co.uk")).toBe("app.example.co.uk");
	});

	it("rejects schemes, ports and paths", () => {
		expect(CookieDomainEnvSchema.safeParse("https://example.com").success).toBe(false);
		expect(CookieDomainEnvSchema.safeParse("localhost:3000").success).toBe(false);
		expect(CookieDomainEnvSchema.safeParse("example.com/path").success).toBe(false);
	});
});

describe("integerEnvSchema", () => {
	const schema = integerEnvSchema({ min: 1, max: 10, defaultValue: 3 });

	it("uses the default only when the variable is unset", () => {
		expect(schema.parse(undefined)).toBe(3);
	});

	it("parses whole numbers inside the bounds, trimming whitespace", () => {
		expect(schema.parse("1")).toBe(1);
		expect(schema.parse(" 10 ")).toBe(10);
	});

	it("fails fast on out-of-range or non-integer values instead of using the default", () => {
		expect(schema.safeParse("0").success).toBe(false);
		expect(schema.safeParse("11").success).toBe(false);
		expect(schema.safeParse("-1").success).toBe(false);
		expect(schema.safeParse("2.5").success).toBe(false);
		expect(schema.safeParse("abc").success).toBe(false);
	});

	it("accepts an open upper bound", () => {
		expect(integerEnvSchema({ min: 0, defaultValue: 0 }).parse("2592000000")).toBe(2_592_000_000);
	});
});

describe("optionalIntegerEnvSchema", () => {
	const schema = optionalIntegerEnvSchema({ min: 1 });

	it("leaves an unset variable undefined", () => {
		expect(schema.parse(undefined)).toBeUndefined();
	});

	it("parses and bounds a set value", () => {
		expect(schema.parse("42")).toBe(42);
		expect(schema.safeParse("0").success).toBe(false);
	});
});

describe("commaSeparatedEnvSchema", () => {
	const schema = commaSeparatedEnvSchema(z.string().regex(/^[a-z]+$/, "must be lowercase letters"));

	it("splits, trims and drops blank entries", () => {
		expect(schema.parse(" a, b,,c ,")).toEqual(["a", "b", "c"]);
	});

	it("requires at least one entry", () => {
		expect(schema.safeParse(" , ").success).toBe(false);
	});

	it("validates every entry", () => {
		expect(schema.safeParse("a,B").success).toBe(false);
	});
});

describe("PostgresUrlEnvSchema", () => {
	it("accepts postgres:// and postgresql:// URLs", () => {
		expect(PostgresUrlEnvSchema.parse("postgresql://user:pass@localhost:5432/app?schema=public")).toBe("postgresql://user:pass@localhost:5432/app?schema=public");
		expect(PostgresUrlEnvSchema.safeParse("postgres://localhost/app").success).toBe(true);
	});

	it("rejects other schemes and bare strings", () => {
		expect(PostgresUrlEnvSchema.safeParse("mysql://localhost/app").success).toBe(false);
		expect(PostgresUrlEnvSchema.safeParse("localhost:5432").success).toBe(false);
	});
});

describe("KafkaBrokersEnvSchema", () => {
	it("parses a comma-separated host:port list", () => {
		expect(KafkaBrokersEnvSchema.parse("localhost:9092, kafka-2.internal:9093")).toEqual(["localhost:9092", "kafka-2.internal:9093"]);
	});

	it("rejects a broker without a port", () => {
		expect(KafkaBrokersEnvSchema.safeParse("localhost").success).toBe(false);
	});
});

describe("NextAppServerEnvSchema", () => {
	it("leaves COOKIE_DOMAIN undefined when unset", () => {
		expect(NextAppServerEnvSchema.parse({ NODE_ENV: "production" })).toEqual({ NODE_ENV: "production", COOKIE_DOMAIN: undefined });
	});

	it("requires NODE_ENV", () => {
		expect(NextAppServerEnvSchema.safeParse({}).success).toBe(false);
	});

	it("rejects undeclared keys so a typo in an env module is caught", () => {
		expect(NextAppServerEnvSchema.safeParse({ NODE_ENV: "test", COOKIE_DOMIAN: "localhost" }).success).toBe(false);
	});
});

describe("createPublicEnvSchema", () => {
	it("builds a strict object schema for NEXT_PUBLIC_* keys", () => {
		const schema = createPublicEnvSchema({ NEXT_PUBLIC_API_URL: HttpUrlEnvSchema });
		expect(Object.keys(schema.shape)).toEqual(["NEXT_PUBLIC_API_URL"]);
		expect(schema.safeParse({ NEXT_PUBLIC_API_URL: "http://localhost:8080", EXTRA: "x" }).success).toBe(false);
	});

	it("throws at runtime when a non-public key is smuggled in", () => {
		const shape: Record<`${typeof PUBLIC_ENV_PREFIX}${string}`, z.ZodType> = { NEXT_PUBLIC_API_URL: HttpUrlEnvSchema };
		const smuggled: Record<`${typeof PUBLIC_ENV_PREFIX}${string}`, z.ZodType> = Object.assign({}, shape, { DATABASE_URL: HttpUrlEnvSchema });
		expect(() => createPublicEnvSchema(smuggled)).toThrow(NonPublicEnvKeyError);
		expect(() => createPublicEnvSchema(smuggled)).toThrow(/DATABASE_URL/);
	});
});

describe("normalizeEnvSource", () => {
	it("treats empty and whitespace-only values as unset", () => {
		expect(normalizeEnvSource({ A: "", B: "   ", C: "value", D: undefined })).toEqual({ A: undefined, B: undefined, C: "value", D: undefined });
	});
});

describe("parseEnvOrThrow", () => {
	const schema = z.strictObject({
		NEXT_PUBLIC_API_URL: HttpUrlEnvSchema,
		NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS: BooleanFlagEnvSchema,
		API_SECRET: z.string().min(32, "must be at least 32 characters"),
	});

	it("returns the typed, transformed values on success", () => {
		const env = parseEnvOrThrow(schema, { NEXT_PUBLIC_API_URL: "https://api.example.com/", API_SECRET: "s".repeat(32) }, SCOPE);
		expect(env).toEqual({ NEXT_PUBLIC_API_URL: "https://api.example.com", NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS: false, API_SECRET: "s".repeat(32) });
	});

	it("lists every missing required variable by name", () => {
		const error = captureEnvError(() => parseEnvOrThrow(schema, {}, SCOPE));
		expect(error.variables).toEqual(["NEXT_PUBLIC_API_URL", "API_SECRET"]);
		expect(error.message).toContain(`Invalid environment configuration for ${SCOPE}:`);
		expect(error.message).toContain("NEXT_PUBLIC_API_URL: is required but not set");
		expect(error.message).toContain("API_SECRET: is required but not set");
	});

	it("reports an empty value as missing, like an unset one", () => {
		const error = captureEnvError(() => parseEnvOrThrow(schema, { NEXT_PUBLIC_API_URL: "", API_SECRET: "s".repeat(32) }, SCOPE));
		expect(error.issues).toEqual([{ variable: "NEXT_PUBLIC_API_URL", problem: "is required but not set" }]);
	});

	it("explains invalid values without printing them", () => {
		const secret = "super-secret-but-too-short";
		const badUrl = "not-a-url-with-private-token-abc123";
		const error = captureEnvError(() => parseEnvOrThrow(schema, { NEXT_PUBLIC_API_URL: badUrl, API_SECRET: secret }, SCOPE));
		expect(error.variables).toEqual(["NEXT_PUBLIC_API_URL", "API_SECRET"]);
		expect(error.message).toContain("NEXT_PUBLIC_API_URL: must be an absolute http:// or https:// URL");
		expect(error.message).toContain("API_SECRET: must be at least 32 characters");
		expect(error.message).not.toContain(secret);
		expect(error.message).not.toContain(badUrl);
	});

	it("redacts a value even when a custom message tries to echo it", () => {
		const leaky = z.strictObject({
			TOKEN: z.string().refine((value: string): boolean => value.startsWith("tok_"), { error: (issue): string => `bad token ${String(issue.input)}` }),
		});
		const secret = "leaked-credential-value";
		const error = captureEnvError(() => parseEnvOrThrow(leaky, { TOKEN: secret }, SCOPE));
		expect(error.message).not.toContain(secret);
		expect(error.message).toContain(`TOKEN: bad token ${REDACTED_ENV_VALUE}`);
	});

	it("keeps a cross-field rule's explanation for a conditionally required variable", () => {
		const conditional = z.object({ MODE: z.enum(["on", "off"]), KEY: z.string().optional() }).superRefine((env, context): void => {
			if (env.MODE === "on" && env.KEY === undefined) {
				context.addIssue({ code: "custom", path: ["KEY"], message: "is required when MODE=on" });
			}
		});
		const error = captureEnvError(() => parseEnvOrThrow(conditional, { MODE: "on" }, SCOPE));
		expect(error.issues).toEqual([{ variable: "KEY", problem: "is required when MODE=on" }]);
	});

	it("names undeclared keys passed to a strict schema", () => {
		const error = captureEnvError(() => parseEnvOrThrow(z.strictObject({ A: z.string().optional() }), { A: "x", B: "y" }, SCOPE));
		expect(error.issues).toEqual([{ variable: "B", problem: "is not declared in this env schema" }]);
	});
});

describe("formatEnvIssues", () => {
	it("renders one bullet per issue and a remediation hint", () => {
		expect(formatEnvIssues(SCOPE, [{ variable: "A", problem: "is required but not set" }])).toBe(
			[
				`Invalid environment configuration for ${SCOPE}:`,
				"  - A: is required but not set",
				"Set these variables (see the app's .env.example). Values are never printed.",
			].join("\n"),
		);
	});
});
