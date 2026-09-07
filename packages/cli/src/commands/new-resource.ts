import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import * as p from "@clack/prompts";
import pc from "picocolors";

import { runGenerateResourceCommand } from "./generate-resource";
import { loadProjectConfig } from "../core/project";
import { normalizeResourceDefinition } from "../ir/normalize";
import { parseResourceDefinitionSource } from "../parser/parse-resource-definition";
import { createClackPrompter } from "../ui/clack-prompter";
import { isInteractiveTerminal } from "../ui/brand";
import { buildResourceDefinition } from "../wizard/build-definition";
import { collectResourceWizardInput } from "../wizard/collect-resource-wizard";
import { renderResourceDefinitionSource } from "../wizard/render-definition-source";
import { printWizardIntro } from "../wizard/terminal-ui";

export interface NewResourceCommandOptions {
	readonly generate: boolean;
	readonly dryRun: boolean;
	readonly skipValidation: boolean;
}

export async function runNewResourceCommand(cwd: string, options: NewResourceCommandOptions): Promise<number> {
	if (!isInteractiveTerminal()) {
		process.stdout.write(pc.red("Interactive wizard requires a TTY. Create resources/definitions/<slug>.resource.ts manually.\n"));
		return 1;
	}

	const config = loadProjectConfig(cwd);
	const prompter = createClackPrompter();

	printWizardIntro();
	p.intro("Let's define your new resource");

	try {
		const wizardInput = await collectResourceWizardInput(prompter, config.definitionsDir, config.rootDir);
		const definition = buildResourceDefinition(wizardInput);
		const source = renderResourceDefinitionSource(definition);

		parseResourceDefinitionSource(source, "wizard.resource.ts");
		const ir = normalizeResourceDefinition(definition);
		const definitionPath = path.join(config.definitionsDir, `${ir.resource.slug}.resource.ts`);

		if (existsSync(definitionPath)) {
			p.log.error(`Definition already exists: ${definitionPath}`);
			return 1;
		}

		p.log.step("Definition preview");
		process.stdout.write(`\n${pc.dim(source)}\n\n`);

		const confirmed = await prompter.confirm("Write this definition file?", { defaultValue: true });
		if (!confirmed) {
			p.cancel("Cancelled.");
			return 0;
		}

		if (options.dryRun) {
			p.log.info(`Dry run — would write ${definitionPath}`);
			p.outro("Preview finished.");
			return 0;
		}

		const writeSpinner = p.spinner();
		writeSpinner.start("Writing definition…");
		await writeFile(definitionPath, source, "utf8");
		writeSpinner.stop(`Wrote ${definitionPath}`);

		const shouldGenerate = options.generate || (await prompter.confirm("Generate artifacts now?", { defaultValue: true }));
		if (!shouldGenerate) {
			p.note(`pnpm app generate resource ${ir.resource.slug}`, "When you're ready");
			p.outro("Definition saved.");
			return 0;
		}

		return await runGenerateResourceCommand(cwd, ir.resource.slug, {
			dryRun: false,
			nonInteractive: false,
			allowDestructive: false,
			skipValidation: options.skipValidation,
			schemaPath: definitionPath,
		});
	} finally {
		prompter.close();
	}
}
