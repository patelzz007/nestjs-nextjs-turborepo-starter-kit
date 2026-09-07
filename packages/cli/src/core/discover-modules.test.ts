import { describe, expect, it } from "vitest";

import { discoverGeneratorModules } from "./discover-modules";
import { loadProjectConfig } from "./project";

describe("discoverGeneratorModules", () => {
	it("detects panel apps with sidebar menus", () => {
		const config = loadProjectConfig(process.cwd());
		const modules = discoverGeneratorModules(config.rootDir);
		const ids = modules.map((module) => module.id);
		expect(ids).toContain("admin");
		expect(ids).toContain("merchant");
		expect(ids).not.toContain("api");
		expect(ids).not.toContain("docs");
	});
});
