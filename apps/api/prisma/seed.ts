import "dotenv/config";

import { prisma } from "./seed/client";
import { SEED_SCENARIO_RUNNERS } from "./seed/scenarios";
import { formatSeedUsage, parseSeedArguments, SeedArgumentError, type SeedCommand } from "./seed/seed-options";
import { assertSeedAllowed } from "./seed/seed-guard";
import { seedLog } from "./seed/seed-log";

// ---------------------------------------------------------------------------
// Orchestrator — parses `--scenario` / `--seed`, then runs that scenario.
//
//   pnpm db:seed                                        (development)
//   pnpm db:seed -- --scenario empty
//   pnpm db:seed -- --scenario enterprise --seed 123
//
// Each scenario lives in `prisma/seed/scenarios/<name>.ts`; per-domain seeders
// live in `prisma/seed/<domain>.ts` and share the client in `prisma/seed/client.ts`.
// ---------------------------------------------------------------------------

/** Conventional exit code for command-line usage errors (EX_USAGE, sysexits.h). */
const EXIT_USAGE_ERROR = 64;

function readCommand(): SeedCommand | null {
	try {
		return parseSeedArguments(process.argv.slice(2));
	} catch (error) {
		if (error instanceof SeedArgumentError) {
			console.error(`❌ Invalid seed arguments\n${error.message}\n\n${formatSeedUsage()}`);
			process.exitCode = EXIT_USAGE_ERROR;
			return null;
		}
		throw error;
	}
}

async function run(): Promise<void> {
	const command = readCommand();
	if (command === null) {
		return;
	}
	if (command.kind === "help") {
		seedLog(formatSeedUsage());
		return;
	}

	try {
		assertSeedAllowed(process.env, command.allowDestructive);
		seedLog(`🌱 Starting seed (scenario: ${command.scenario}, seed: ${String(command.seed)})...\n`);
		await SEED_SCENARIO_RUNNERS[command.scenario](command);
	} catch (error) {
		console.error("❌ Seed failed:", error);
		process.exitCode = 1;
	} finally {
		await prisma.$disconnect();
	}
}

void run();
