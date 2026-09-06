import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import * as p from "@clack/prompts";

import { runDoctorCommand, runGenerateResourceCommand } from "../commands/generate-resource.js";
import { runNewResourceCommand } from "../commands/new-resource.js";
import { resolveDefinitionPath, validateResourceDefinition } from "../commands/schema-commands.js";
import { loadProjectConfig } from "../core/project.js";
import { normalizeResourceDefinition } from "../ir/normalize.js";
import { parseResourceDefinitionFile } from "../parser/parse-resource-definition.js";
import { printAppBanner, isInteractiveTerminal } from "./brand.js";
import { printRoutesTable } from "./plan-display.js";

type HubAction = "new" | "generate" | "routes" | "validate" | "doctor" | "exit";

async function listResourceSlugs(definitionsDir: string): Promise<string[]> {
	if (!existsSync(definitionsDir)) {
		return [];
	}
	const entries = await readdir(definitionsDir);
	return entries
		.filter((file) => file.endsWith(".resource.ts"))
		.map((file) => file.replace(/\.resource\.ts$/, ""))
		.sort((left, right) => left.localeCompare(right));
}

async function runRoutesList(cwd: string): Promise<void> {
	const config = loadProjectConfig(cwd);
	const entries = await readdir(config.definitionsDir);
	const rows: { slug: string; contractKey: string; label: string; fieldCount: number }[] = [];
	for (const entry of entries.filter((file) => file.endsWith(".resource.ts"))) {
		const source = await readFile(`${config.definitionsDir}/${entry}`, "utf8");
		const definition = parseResourceDefinitionFile(source, entry);
		const ir = normalizeResourceDefinition(definition);
		rows.push({
			slug: ir.resource.slug,
			contractKey: ir.resource.contractKey,
			label: ir.admin?.navigation?.label ?? ir.resource.plural,
			fieldCount: ir.fields.length,
		});
	}
	printRoutesTable(rows);
}

async function runValidatePicker(cwd: string): Promise<number> {
	const config = loadProjectConfig(cwd);
	const slugs = await listResourceSlugs(config.definitionsDir);
	if (slugs.length === 0) {
		p.log.warning("No resource definitions found. Create one first.");
		return 1;
	}
	const slug = await p.select({
		message: "Which definition should we validate?",
		options: slugs.map((name) => ({ value: name, label: name })),
	});
	if (p.isCancel(slug)) {
		p.cancel("Cancelled.");
		return 0;
	}
	const path = resolveDefinitionPath(cwd, slug);
	return (await validateResourceDefinition(path, { verbose: true })) ? 0 : 1;
}

async function runGeneratePicker(cwd: string): Promise<number> {
	const config = loadProjectConfig(cwd);
	const slugs = await listResourceSlugs(config.definitionsDir);
	if (slugs.length === 0) {
		p.log.warning("No resource definitions found. Run the wizard to create one.");
		return 1;
	}
	const slug = await p.select({
		message: "Which resource should we generate?",
		options: slugs.map((name) => ({ value: name, label: name })),
	});
	if (p.isCancel(slug)) {
		p.cancel("Cancelled.");
		return 0;
	}
	const dryRun = await p.confirm({
		message: "Dry run only (preview plan, no writes)?",
		initialValue: false,
	});
	if (p.isCancel(dryRun)) {
		p.cancel("Cancelled.");
		return 0;
	}
	return runGenerateResourceCommand(cwd, slug, {
		dryRun,
		nonInteractive: false,
		allowDestructive: false,
		skipValidation: dryRun,
	});
}

async function dispatchHubAction(cwd: string, action: HubAction): Promise<number> {
	switch (action) {
		case "new":
			return runNewResourceCommand(cwd, { generate: false, dryRun: false, skipValidation: false });
		case "generate":
			return runGeneratePicker(cwd);
		case "routes":
			await runRoutesList(cwd);
			return 0;
		case "validate":
			return runValidatePicker(cwd);
		case "doctor":
			return runDoctorCommand(cwd, { verbose: true });
		case "exit":
			p.outro("See you soon.");
			return 0;
		default:
			return 0;
	}
}

export async function runInteractiveHub(cwd: string): Promise<number> {
	if (!isInteractiveTerminal()) {
		process.stdout.write("Interactive mode requires a TTY. Run pnpm app --help for commands.\n");
		return 1;
	}

	printAppBanner();
	p.intro("What would you like to do?");

	const action = await p.select<HubAction>({
		message: "Choose an action",
		options: [
			{ value: "new", label: "Create a new resource", hint: "interactive wizard" },
			{ value: "generate", label: "Generate from definition", hint: "API, contracts, admin UI" },
			{ value: "routes", label: "List resources", hint: "show all definitions" },
			{ value: "validate", label: "Validate a definition", hint: "check .resource.ts syntax" },
			{ value: "doctor", label: "Run environment check", hint: "verify monorepo layout" },
			{ value: "exit", label: "Exit", hint: "close the CLI" },
		],
	});

	if (p.isCancel(action)) {
		p.cancel("Cancelled.");
		return 0;
	}

	const code = await dispatchHubAction(cwd, action);

	if (action !== "exit" && code === 0) {
		const again = await p.confirm({
			message: "Do something else?",
			initialValue: false,
		});
		if (!p.isCancel(again) && again) {
			return runInteractiveHub(cwd);
		}
		p.outro("Done.");
	}

	return code;
}

export function shouldLaunchInteractiveHub(argv: readonly string[]): boolean {
	if (!isInteractiveTerminal()) {
		return false;
	}
	const args = argv.slice(2);
	if (args.length === 0) {
		return true;
	}
	if (args.length === 1 && (args[0] === "interactive" || args[0] === "hub")) {
		return true;
	}
	return false;
}
