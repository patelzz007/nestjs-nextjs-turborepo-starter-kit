import * as p from "@clack/prompts";
import pc from "picocolors";

import { initGeneratorModules } from "../generator/environment";
import { printAppBanner } from "../ui/brand";

export async function runInitModulesCommand(cwd: string): Promise<number> {
	printAppBanner();
	p.intro("Generator UI modules");

	const result = await initGeneratorModules(cwd);
	if (!result.success) {
		p.log.error(result.error ?? "No UI panel modules were discovered.");
		p.outro(pc.red("Nothing to write."));
		return 1;
	}

	for (const module of result.modules) {
		p.log.success(`${pc.cyan(module.id)} → ${pc.dim(module.resourceRouteTemplate)}`);
	}

	p.outro(pc.green(`Wrote ${String(result.modules.length)} module(s) to ${result.manifestPath}`));
	return 0;
}
