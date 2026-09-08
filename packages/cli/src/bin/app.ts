#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { Command } from "commander";

import * as p from "@clack/prompts";
import pc from "picocolors";

import { loadGeneratorModules } from "../core/load-modules";
import { runInitModulesCommand } from "../commands/init-modules";
import { runDoctorCommand, runGenerateResourceCommand } from "../commands/generate-resource";
import { runRollbackResourceCommand } from "../commands/rollback-resource";
import { runNewResourceCommand } from "../commands/new-resource";
import { inspectResourceDefinition, resolveDefinitionPath, validateResourceDefinition } from "../commands/schema-commands";
import { loadProjectConfig } from "../core/project";
import { ensureCliEslintConfig } from "../generators/workspace/ensure-cli-eslint-config";
import { normalizeResourceDefinition } from "../ir/normalize";
import { parseResourceDefinitionFile } from "../parser/parse-resource-definition";
import { printAppBanner, CLI_VERSION } from "../ui/brand";
import { printRoutesTable } from "../ui/plan-display";
import { runInteractiveHub, shouldLaunchInteractiveHub } from "../ui/interactive-hub";

if (shouldLaunchInteractiveHub(process.argv)) {
	const code = await runInteractiveHub(process.cwd());
	process.exit(code);
}

const program = new Command();

program.name("app").description("Contract-driven application scaffolding CLI").version(CLI_VERSION);

program
	.command("init")
	.description("Initialize generator metadata in the current monorepo")
	.action(async () => {
		const config = loadProjectConfig(process.cwd());
		printAppBanner();
		p.intro("Project layout");
		p.log.info(`Root: ${pc.cyan(config.rootDir)}`);
		p.log.info(`Definitions: ${pc.cyan(config.definitionsDir)}`);
		const eslintStatus = await ensureCliEslintConfig(config.rootDir);
		if (eslintStatus === "repaired") {
			p.log.success("Repaired packages/cli/eslint.config.js");
		}
		try {
			const modules = await loadGeneratorModules(config, { seedIfMissing: true });
			p.log.success(`UI modules manifest ready (${String(modules.modules.length)} module(s))`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			p.log.warn(message);
		}
		p.outro("Ready to scaffold.");
	});

program
	.command("init-modules")
	.description("Discover and write .app/generator-modules.json")
	.action(async () => {
		const code = await runInitModulesCommand(process.cwd());
		process.exit(code);
	});

program
	.command("interactive")
	.alias("hub")
	.description("Launch the interactive CLI menu")
	.action(async () => {
		const code = await runInteractiveHub(process.cwd());
		process.exit(code);
	});

const generate = program.command("generate").description("Generate application artifacts");

const generateResourceOptions = [
	["--schema <path>", "Path to resource definition file"],
	["--dry-run", "Show plan without writing files", false],
	["--non-interactive", "Skip confirmation prompts", false],
	["--allow-destructive", "Allow destructive schema changes", false],
	["--skip-validation", "Skip format/lint/typecheck after generation", false],
] as const;

function attachGenerateResourceOptions(command: Command): Command {
	for (const [flags, description, defaultValue] of generateResourceOptions) {
		if (defaultValue === undefined) {
			command.option(flags, description);
		} else {
			command.option(flags, description, defaultValue);
		}
	}
	return command;
}

attachGenerateResourceOptions(
	generate
		.command("resource <name>")
		.description("Generate a full resource from a .resource.ts definition")
		.action(async (name: string, options: { schema?: string; dryRun?: boolean; nonInteractive?: boolean; allowDestructive?: boolean; skipValidation?: boolean }) => {
			const code = await runGenerateResourceCommand(process.cwd(), name, {
				dryRun: options.dryRun === true,
				nonInteractive: options.nonInteractive === true,
				allowDestructive: options.allowDestructive === true,
				skipValidation: options.skipValidation === true,
				schemaPath: options.schema,
			});
			process.exit(code);
		}),
);

for (const alias of ["module", "model", "page", "component", "api", "permission"]) {
	attachGenerateResourceOptions(
		generate
			.command(`${alias} <name>`)
			.description(`Alias for generate resource (${alias} slice is included in the full resource plan)`)
			.action(async (name: string, options: { schema?: string; dryRun?: boolean; nonInteractive?: boolean; allowDestructive?: boolean; skipValidation?: boolean }) => {
				p.log.info(`Running full resource generation for ${alias} slice.`);
				const code = await runGenerateResourceCommand(process.cwd(), name, {
					dryRun: options.dryRun === true,
					nonInteractive: options.nonInteractive === true,
					allowDestructive: options.allowDestructive === true,
					skipValidation: options.skipValidation === true,
					schemaPath: options.schema,
				});
				process.exit(code);
			}),
	);
}

const schema = program.command("schema").description("Resource schema commands");

schema
	.command("validate [name]")
	.description("Validate a resource definition")
	.option("--schema <path>", "Path to resource definition file")
	.action(async (name: string | undefined, options: { schema?: string }) => {
		const path = options.schema ?? (name ? resolveDefinitionPath(process.cwd(), name) : undefined);
		if (path === undefined) {
			p.log.error("Provide a resource name or --schema path.");
			process.exit(1);
		}
		const ok = await validateResourceDefinition(path, { verbose: true });
		process.exit(ok ? 0 : 1);
	});

schema
	.command("inspect <name>")
	.description("Print normalized IR for a resource definition")
	.option("--schema <path>", "Path to resource definition file")
	.action(async (name: string, options: { schema?: string }) => {
		try {
			const definitionPath = options.schema ?? resolveDefinitionPath(process.cwd(), name);
			await inspectResourceDefinition(definitionPath);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			p.log.error(message);
			process.exit(1);
		}
	});

schema
	.command("diff <name>")
	.description("Show planned changes for a resource")
	.option("--schema <path>", "Path to resource definition file")
	.action(async (name: string, options: { schema?: string }) => {
		const code = await runGenerateResourceCommand(process.cwd(), name, {
			dryRun: true,
			nonInteractive: true,
			allowDestructive: false,
			skipValidation: true,
			schemaPath: options.schema,
		});
		process.exit(code);
	});

program
	.command("rollback <name>")
	.description("Rollback generator artifacts for a resource (dry-run by default)")
	.option("--apply", "Execute the rollback plan", false)
	.option("--include-definition", "Also delete the .resource.ts definition file", false)
	.option("--non-interactive", "Skip confirmation prompts", false)
	.action(async (name: string, options: { apply?: boolean; includeDefinition?: boolean; nonInteractive?: boolean }) => {
		const code = await runRollbackResourceCommand(process.cwd(), name, {
			dryRun: options.apply !== true,
			apply: options.apply === true,
			includeDefinition: options.includeDefinition === true,
			nonInteractive: options.nonInteractive === true,
		});
		process.exit(code);
	});

program
	.command("sync <name>")
	.description("Regenerate a resource from its definition")
	.option("--dry-run", "Show plan without writing files", false)
	.option("--allow-destructive", "Allow destructive schema changes", false)
	.option("--skip-validation", "Skip format/lint/typecheck after generation", false)
	.action(async (name: string, options: { dryRun?: boolean; allowDestructive?: boolean; skipValidation?: boolean }) => {
		const code = await runGenerateResourceCommand(process.cwd(), name, {
			dryRun: options.dryRun === true,
			nonInteractive: true,
			allowDestructive: options.allowDestructive === true,
			skipValidation: options.skipValidation === true,
		});
		process.exit(code);
	});

program
	.command("migrate <name>")
	.description("Run prisma migrate dev for a generated resource")
	.action((name: string) => {
		p.note(`pnpm db:migrate`, `Review schema changes for ${name}`);
	});

const routes = program.command("routes").description("Generated route metadata");

routes
	.command("list")
	.description("List generated API routes from definitions")
	.action(async () => {
		try {
			const config = loadProjectConfig(process.cwd());
			const entries = await readdir(config.definitionsDir);
			const rows: { slug: string; contractKey: string; label: string; fieldCount: number }[] = [];
			for (const entry of entries.filter((file) => file.endsWith(".resource.ts"))) {
				const source = await readFile(`${config.definitionsDir}/${entry}`, "utf8");
				const definition = parseResourceDefinitionFile(source, entry);
				const modulesManifest = await loadGeneratorModules(config, { seedIfMissing: true });
				const ir = normalizeResourceDefinition(definition, { modules: modulesManifest.modules });
				const firstUi = ir.scope.ui[0];
				const label = firstUi !== undefined ? (ir.uiTargets[firstUi]?.navigation?.label ?? ir.resource.plural) : ir.resource.plural;
				rows.push({
					slug: ir.resource.slug,
					contractKey: ir.resource.contractKey,
					label,
					fieldCount: ir.fields.length,
				});
			}
			printAppBanner();
			printRoutesTable(rows);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`${message}\n`);
			process.exit(1);
		}
	});

program
	.command("doctor")
	.description("Validate project compatibility for the generator")
	.action(async () => {
		const code = await runDoctorCommand(process.cwd(), { verbose: true });
		process.exit(code);
	});

const newCommand = program.command("new").description("Create new generator inputs interactively");

newCommand
	.command("resource")
	.description("Interactive wizard to create a .resource.ts definition and optionally generate artifacts")
	.option("--generate", "Generate API, contracts, and admin UI after writing the definition", false)
	.option("--dry-run", "Show prompts and preview without writing files", false)
	.option("--skip-validation", "Skip format/lint/typecheck after generation", false)
	.action(async (options: { generate?: boolean; dryRun?: boolean; skipValidation?: boolean }) => {
		const code = await runNewResourceCommand(process.cwd(), {
			generate: options.generate === true,
			dryRun: options.dryRun === true,
			skipValidation: options.skipValidation === true,
		});
		process.exit(code);
	});

await program.parseAsync(process.argv);
