import { z } from "zod";

import { MAX_RANDOM_SEED } from "./prng";

// ---------------------------------------------------------------------------
// `pnpm db:seed` command-line contract.
//
//   pnpm db:seed                                        → development (default)
//   pnpm db:seed -- --scenario empty
//   pnpm db:seed -- --scenario enterprise --seed 123
//   pnpm db:seed -- --help
//
// argv is untrusted input, so it is tokenised here and validated with zod
// before any database work starts.
// ---------------------------------------------------------------------------

export const SeedScenarioSchema = z.enum(["empty", "development", "enterprise"]);
export type SeedScenario = z.infer<typeof SeedScenarioSchema>;

export const DEFAULT_SEED_SCENARIO: SeedScenario = "development";

/** Default PRNG seed when `--seed` is omitted (any fixed value keeps runs reproducible). */
export const DEFAULT_RANDOM_SEED = 1;

/** Human-readable summary of each scenario — rendered by `--help` and the docs. */
export const SEED_SCENARIO_DESCRIPTIONS: Readonly<Record<SeedScenario, string>> = {
	empty: "Reference data only: permissions, roles, role grants, capability catalog, ABAC demo condition. No users or tenants.",
	development: "Reference data + the full demo dataset (test accounts, organizations, rewards, stores, products, geo). Default.",
	enterprise: "Reference data + test accounts + one large deterministic organization (many locations/stores/members/products). Honors --seed.",
};

const SCENARIO_FLAG = "--scenario";
const SEED_FLAG = "--seed";
/** Opt-in to seed a database that is not a local development/test database (see seed-guard.ts). */
export const ALLOW_DESTRUCTIVE_FLAG = "--allow-destructive";
const HELP_FLAGS: ReadonlySet<string> = new Set<string>(["--help", "-h"]);
/** pnpm/turbo forward a literal `--` separator in some versions — it carries no meaning here. */
const ARGUMENT_SEPARATOR = "--";

const SeedValueSchema = z
	.string()
	.regex(/^\d+$/, `--seed must be a non-negative integer (0–${String(MAX_RANDOM_SEED)})`)
	.transform(Number)
	.pipe(
		z
			.number()
			.int()
			.min(0)
			.max(MAX_RANDOM_SEED, `--seed must be at most ${String(MAX_RANDOM_SEED)}`),
	);

const RawSeedArgumentsSchema = z
	.object({
		scenario: SeedScenarioSchema.default(DEFAULT_SEED_SCENARIO),
		seed: SeedValueSchema.default(DEFAULT_RANDOM_SEED),
		allowDestructive: z.boolean().default(false),
	})
	.strict();

export type SeedRunOptions = z.output<typeof RawSeedArgumentsSchema>;

export type SeedCommand = { readonly kind: "help" } | ({ readonly kind: "run" } & SeedRunOptions);

export class SeedArgumentError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "SeedArgumentError";
	}
}

interface RawSeedArguments {
	scenario?: string;
	seed?: string;
	allowDestructive?: boolean;
}

type ValueFlagName = "scenario" | "seed";

function valueFlagName(flag: string): ValueFlagName | null {
	if (flag === SCENARIO_FLAG) return "scenario";
	if (flag === SEED_FLAG) return "seed";
	return null;
}

function splitInlineValue(token: string): { readonly flag: string; readonly inlineValue: string | undefined } {
	const equalsIndex = token.indexOf("=");
	if (equalsIndex === -1) {
		return { flag: token, inlineValue: undefined };
	}
	return { flag: token.slice(0, equalsIndex), inlineValue: token.slice(equalsIndex + 1) };
}

/** Tokenises argv into raw string values; flag *shape* errors are reported here, value errors by zod. */
function tokenize(argv: readonly string[]): RawSeedArguments | "help" {
	const raw: RawSeedArguments = {};
	let index = 0;

	while (index < argv.length) {
		const token = argv.at(index);
		index += 1;
		if (token === undefined || token === ARGUMENT_SEPARATOR) {
			continue;
		}
		if (HELP_FLAGS.has(token)) {
			return "help";
		}
		if (token === ALLOW_DESTRUCTIVE_FLAG) {
			if (raw.allowDestructive !== undefined) {
				throw new SeedArgumentError(`${ALLOW_DESTRUCTIVE_FLAG} was given more than once.`);
			}
			raw.allowDestructive = true;
			continue;
		}

		const { flag, inlineValue } = splitInlineValue(token);
		const name = valueFlagName(flag);
		if (name === null) {
			throw new SeedArgumentError(`Unknown argument "${token}". Run with --help for usage.`);
		}
		if (raw[name] !== undefined) {
			throw new SeedArgumentError(`${flag} was given more than once.`);
		}

		let value = inlineValue;
		if (value === undefined) {
			const next = argv.at(index);
			if (next === undefined || next.startsWith("-")) {
				throw new SeedArgumentError(`${flag} requires a value.`);
			}
			value = next;
			index += 1;
		}
		if (value.length === 0) {
			throw new SeedArgumentError(`${flag} requires a value.`);
		}
		raw[name] = value;
	}

	return raw;
}

/** Parses `process.argv.slice(2)` for the seed CLI. Throws {@link SeedArgumentError} on invalid input. */
export function parseSeedArguments(argv: readonly string[]): SeedCommand {
	const tokens = tokenize(argv);
	if (tokens === "help") {
		return { kind: "help" };
	}

	const parsed = RawSeedArgumentsSchema.safeParse(tokens);
	if (!parsed.success) {
		throw new SeedArgumentError(z.prettifyError(parsed.error));
	}
	return { kind: "run", ...parsed.data };
}

/** `--help` text. */
export function formatSeedUsage(): string {
	const nameWidth = Math.max(...SeedScenarioSchema.options.map((scenario) => scenario.length));
	const scenarioLines = SeedScenarioSchema.options.map((scenario) => `  ${scenario.padEnd(nameWidth)}  ${SEED_SCENARIO_DESCRIPTIONS[scenario]}`);
	return [
		"Usage: pnpm db:seed [-- --scenario <name>] [--seed <n>] [--allow-destructive]",
		"",
		"Options:",
		`  --scenario <name>  Dataset to seed (default: ${DEFAULT_SEED_SCENARIO})`,
		`  --seed <n>         PRNG seed for generated data, 0–${String(MAX_RANDOM_SEED)} (default: ${String(DEFAULT_RANDOM_SEED)})`,
		`  ${ALLOW_DESTRUCTIVE_FLAG}  Seed a database that is not local development/test (rewrites the demo tenants' rows)`,
		"  -h, --help         Show this message",
		"",
		"Scenarios:",
		...scenarioLines,
	].join("\n");
}
