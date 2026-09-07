import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import * as p from "@clack/prompts";
import pc from "picocolors";

import { loadGeneratorModules } from "../core/load-modules";
import { loadProjectConfig } from "../core/project";
import { runGeneratorDoctor } from "../generator/environment";
import { buildPlanActions, planResourceFiles } from "../core/planner";
import { collectManifestPaths, readManifest } from "../core/manifest";
import { generateResource } from "../generators/generate-resource";
import { normalizeResourceDefinition } from "../ir/normalize";
import { loadAllResourceDefinitions } from "../parser/load-all-resource-definitions";
import { parseResourceDefinitionFile } from "../parser/parse-resource-definition";
import { printAppBanner, isInteractiveTerminal } from "../ui/brand";
import { printDoctorResults, printGenerationPlan, printResourceSummary } from "../ui/plan-display";
import { runPostGenerateValidation } from "../validation/post-generate";
import { resolveDefinitionPath, validateResourceDefinition } from "./schema-commands";

export interface GenerateResourceCommandOptions {
	readonly dryRun: boolean;
	readonly nonInteractive: boolean;
	readonly allowDestructive: boolean;
	readonly skipValidation: boolean;
	readonly schemaPath?: string;
}

export interface CommandDisplayOptions {
	readonly verbose?: boolean;
}

export async function runGenerateResourceCommand(cwd: string, resourceName: string, options: GenerateResourceCommandOptions): Promise<number> {
	const config = loadProjectConfig(cwd);
	const definitionPath = options.schemaPath ?? resolveDefinitionPath(cwd, resourceName);
	const interactive = !options.nonInteractive && isInteractiveTerminal();

	if (!existsSync(definitionPath)) {
		if (interactive) {
			p.log.error(`Resource definition not found: ${definitionPath}`);
		} else {
			process.stdout.write(pc.red(`Resource definition not found: ${definitionPath}\n`));
		}
		return 1;
	}

	const valid = await validateResourceDefinition(definitionPath, { verbose: interactive });
	if (!valid) {
		return 1;
	}

	const source = await readFile(definitionPath, "utf8");
	const definition = parseResourceDefinitionFile(source, definitionPath);
	const modulesManifest = await loadGeneratorModules(config, { seedIfMissing: true });
	const allDefinitions = await loadAllResourceDefinitions(config.definitionsDir);
	const ir = normalizeResourceDefinition(definition, { allDefinitions, modules: modulesManifest.modules });
	const planned = planResourceFiles(config, ir, modulesManifest);
	const existingManifest = await readManifest(config.rootDir, ir.resource.slug);
	const actions = buildPlanActions(planned, collectManifestPaths(existingManifest));

	if (interactive) {
		printAppBanner();
		p.intro(`Generate ${pc.cyan(ir.resource.name)}`);
		printResourceSummary(ir);
		printGenerationPlan(actions);
	} else {
		process.stdout.write(pc.bold(`\nGenerating ${ir.resource.name}\n\n`));
		for (const action of actions) {
			const color = action.action === "create" ? pc.green : action.action === "modify" ? pc.yellow : action.action === "skip" ? pc.blue : pc.red;
			process.stdout.write(`${color(action.action.toUpperCase())} ${action.path} — ${action.reason}\n`);
		}
	}

	if (options.dryRun) {
		if (interactive) {
			p.log.info("Dry run complete — no files were written.");
			p.outro("Preview finished.");
		} else {
			process.stdout.write(pc.cyan("\nDry run complete. No files were written.\n"));
		}
		return 0;
	}

	if (interactive) {
		const proceed = await p.confirm({
			message: "Proceed with generation?",
			initialValue: true,
		});
		if (p.isCancel(proceed) || !proceed) {
			p.cancel("Generation cancelled.");
			return 0;
		}
	} else if (!options.nonInteractive && process.stdin.isTTY) {
		process.stdout.write("\nProceed? [Y/n] ");
		const answer = await new Promise<string>((resolve) => {
			process.stdin.setEncoding("utf8");
			process.stdin.once("data", (data) => {
				const text = typeof data === "string" ? data : data.toString();
				resolve(text.trim());
			});
		});
		if (answer.toLowerCase() === "n") {
			return 0;
		}
	}

	const spinner = interactive ? p.spinner() : undefined;
	spinner?.start("Generating artifacts…");

	const result = await generateResource(config, ir, modulesManifest, {
		dryRun: false,
		allowDestructive: options.allowDestructive,
		runMigrate: !options.dryRun,
	});

	if (interactive) {
		spinner?.stop(`Wrote ${String(result.writtenFiles.length)} file(s)`);
		if (result.skippedFiles.length > 0) {
			p.log.info(`Skipped ${String(result.skippedFiles.length)} developer-owned scaffold(s).`);
		}
	} else {
		process.stdout.write(pc.green(`\nWrote ${String(result.writtenFiles.length)} file(s).\n`));
		if (result.skippedFiles.length > 0) {
			process.stdout.write(pc.blue(`Skipped ${String(result.skippedFiles.length)} developer-owned scaffold(s).\n`));
		}
	}

	if (!options.skipValidation) {
		const validation = await runPostGenerateValidation(config.rootDir, {
			useSpinner: interactive,
			resourceSlug: ir.resource.slug,
			writtenPaths: [...result.writtenFiles, ...result.patchedFiles],
		});
		const failed = validation.some((step) => !step.success);
		if (failed) {
			if (interactive) {
				p.outro(pc.red("Validation failed — check output above."));
			}
			return 1;
		}
	}

	if (interactive) {
		p.note([`pnpm db:migrate`, `pnpm dev`, `open admin → /${ir.resource.slug}`].join("\n"), "Next steps");
		p.outro(pc.green(`${ir.resource.name} is ready.`));
	} else if (!options.nonInteractive) {
		process.stdout.write(pc.cyan("\nNext: pnpm db:migrate && pnpm dev\n"));
	}

	return 0;
}

export async function runDoctorCommand(cwd: string, display: CommandDisplayOptions = {}): Promise<number> {
	const verbose = display.verbose === true && isInteractiveTerminal();
	const result = await runGeneratorDoctor(cwd);

	if (verbose) {
		printAppBanner();
		p.intro("Environment check");
		printDoctorResults(result.checks.map((check) => ({ label: check.label, ok: check.ok })));
		if (result.success) {
			p.outro(pc.green("Everything looks good — you're ready to scaffold."));
		} else {
			p.log.error("Some checks failed. Fix the paths above and run doctor again.");
			p.outro(pc.red("Environment is not ready."));
		}
	} else {
		for (const check of result.checks) {
			process.stdout.write(`${check.ok ? pc.green("✓") : pc.red("✗")} ${check.label}\n`);
		}
	}

	return result.success ? 0 : 1;
}
