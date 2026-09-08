import { loadProjectConfig } from "../core/project";
import { previewResourceRollback, rollbackResource, type ApplyRollbackOptions, type ApplyRollbackResult } from "../rollback/apply-rollback";
import type { BuildRollbackPlanOptions } from "../rollback/plan-rollback";

export {
	applyResourceGenerator,
	listGeneratorUiModules,
	listResourceDefinitions,
	listResourceGeneratorModels,
	parseWizardResourceInput,
	previewGenerationPlanFileDiff,
	previewResourceGenerator,
} from "./programmatic";
export { initGeneratorModules, runGeneratorDoctor } from "./environment";

export function previewResourceRollbackFromCwd(cwd: string, slug: string, options: BuildRollbackPlanOptions): Promise<ApplyRollbackResult["plan"]> {
	const config = loadProjectConfig(cwd);
	return previewResourceRollback(config, slug, options);
}

export function rollbackResourceFromCwd(cwd: string, slug: string, options: ApplyRollbackOptions): Promise<ApplyRollbackResult> {
	const config = loadProjectConfig(cwd);
	return rollbackResource(config, slug, options);
}
