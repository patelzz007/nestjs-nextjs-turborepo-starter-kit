import * as p from "@clack/prompts";
import pc from "picocolors";

import { loadProjectConfig } from "../core/project";
import { previewResourceRollback, rollbackResource } from "../rollback/apply-rollback";
import type { RollbackPlanStep } from "../rollback/rollback-schema";
import { printAppBanner, isInteractiveTerminal } from "../ui/brand";

export interface RollbackResourceCommandOptions {
	readonly dryRun: boolean;
	readonly apply: boolean;
	readonly includeDefinition: boolean;
	readonly nonInteractive: boolean;
}

const ACTION_LABELS: Record<RollbackPlanStep["action"], string> = {
	unpatch: pc.magenta("unpatch"),
	delete: pc.red("delete"),
	"remove-directory": pc.yellow("remove-dir"),
};

function printRollbackPlan(slug: string, steps: readonly RollbackPlanStep[], warnings: readonly string[]): void {
	process.stdout.write(`${pc.bold(pc.white("Rollback plan"))}  ${pc.dim(slug)}\n`);
	process.stdout.write(`${pc.dim("─".repeat(52))}\n`);
	if (steps.length === 0) {
		process.stdout.write(`${pc.yellow("!")} No rollback actions planned.\n\n`);
		return;
	}
	for (const step of steps) {
		process.stdout.write(`  ${ACTION_LABELS[step.action]} ${pc.dim("│")} ${step.path}\n`);
		process.stdout.write(`  ${pc.dim("│")} ${pc.dim(step.reason)}\n`);
	}
	process.stdout.write("\n");
	if (warnings.length > 0) {
		process.stdout.write(`${pc.bold("Warnings")}\n`);
		for (const warning of warnings) {
			process.stdout.write(`  ${pc.yellow("!")} ${warning}\n`);
		}
		process.stdout.write("\n");
	}
}

export async function runRollbackResourceCommand(cwd: string, resourceName: string, options: RollbackResourceCommandOptions): Promise<number> {
	const config = loadProjectConfig(cwd);
	const interactive = !options.nonInteractive && isInteractiveTerminal();
	const slug = resourceName.trim();
	const dryRun = !options.apply;

	if (interactive) {
		printAppBanner();
		p.intro(`Rollback ${pc.cyan(slug)}`);
	}

	const plan = await previewResourceRollback(config, slug, {
		includeDefinition: options.includeDefinition,
	});

	if (!plan.canRollback) {
		for (const warning of plan.warnings) {
			if (interactive) {
				p.log.error(warning);
			} else {
				process.stdout.write(pc.red(`${warning}\n`));
			}
		}
		return 1;
	}

	printRollbackPlan(slug, plan.steps, plan.warnings);

	if (dryRun) {
		if (interactive) {
			p.log.info("Dry run complete — no files were changed.");
			p.outro("Pass --apply to execute this rollback.");
		} else {
			process.stdout.write(pc.cyan("Dry run complete. Pass --apply to execute.\n"));
		}
		return 0;
	}

	if (interactive) {
		const proceed = await p.confirm({
			message: "Apply this rollback?",
			initialValue: false,
		});
		if (p.isCancel(proceed) || !proceed) {
			p.cancel("Rollback cancelled.");
			return 0;
		}
	}

	const spinner = interactive ? p.spinner() : undefined;
	spinner?.start("Rolling back…");

	const result = await rollbackResource(config, slug, {
		dryRun: false,
		includeDefinition: options.includeDefinition,
	});

	if (interactive) {
		spinner?.stop("Rollback complete");
		p.outro(pc.green(`${slug} generator artifacts were removed.`));
	} else {
		process.stdout.write(pc.green(`Rollback complete for ${slug}.\n`));
	}

	if (!result.applied) {
		return 1;
	}

	return 0;
}
