import { seedReferenceData } from "../reference-data";
import type { SeedRunOptions, SeedScenario } from "../seed-options";
import { runDevelopmentScenario } from "./development";
import { runEnterpriseScenario } from "./enterprise";
import { seedLog } from "../seed-log";

type ScenarioRunner = (options: SeedRunOptions) => Promise<void>;

async function runEmptyScenario(): Promise<void> {
	const { permissions, roles } = await seedReferenceData();
	seedLog(`
🎉 Seed complete! (scenario: empty)

Permissions : ${String(permissions.length)}
Roles       : ${String(roles.length)}

No users or tenants were created. Existing rows were left untouched —
run \`pnpm db:reset\` first if you need a truly empty database.
`);
}

/**
 * One runner per scenario. Typed as a full `Record<SeedScenario, …>`, so adding
 * a scenario to SeedScenarioSchema fails to compile until it has a runner here.
 */
export const SEED_SCENARIO_RUNNERS: Readonly<Record<SeedScenario, ScenarioRunner>> = {
	empty: runEmptyScenario,
	development: runDevelopmentScenario,
	enterprise: runEnterpriseScenario,
};
