import { describe, expect, it } from "vitest";

import { planResourceFiles } from "./planner";
import { loadProjectConfig } from "./project";
import { buildGeneratorModulesManifest } from "./load-modules";
import { normalizeResourceDefinition } from "../ir/normalize";
import { parseResourceDefinitionSource } from "../parser/parse-resource-definition";

const SAMPLE = `import { defineResource } from "@workspace/cli";

export default defineResource({
	version: 2,
	name: "SampleResource",
	scope: {
		api: true,
		shared: true,
		client: true,
		ui: ["admin"],
	},
	model: {
		name: "SampleResource",
		softDelete: true,
		concurrency: true,
		idempotency: true,
		rls: "admin-only",
		fields: {
			name: { type: "string", required: true, searchable: true, sortable: true },
			status: { type: "enum", values: ["draft", "published"], default: "draft" },
		},
	},
	ui: {
		admin: {
			navigation: { label: "Sample Resources" },
			list: { searchable: ["name"], sortable: ["name", "createdAt"], filters: [], columns: ["name"] },
			form: { layout: "single-column", fields: ["name"] },
		},
	},
	workflow: {
		field: "status",
		initial: "draft",
		transitions: { draft: ["published"], published: ["archived"], archived: [] },
	},
	audit: true,
});
`;

const API_ONLY_SAMPLE = `import { defineResource } from "@workspace/cli";

export default defineResource({
	version: 2,
	name: "ApiOnlyResource",
	scope: {
		api: true,
		shared: true,
		client: true,
		ui: [],
	},
	model: {
		name: "ApiOnlyResource",
		rls: "admin-only",
		fields: {
			name: { type: "string", required: true },
		},
	},
});
`;

describe("planResourceFiles", () => {
	it("plans deterministic generator-owned files for admin UI", () => {
		const config = loadProjectConfig(process.cwd());
		const modulesManifest = buildGeneratorModulesManifest(config.rootDir);
		const definition = parseResourceDefinitionSource(SAMPLE, "sample-resource.resource.ts");
		const ir = normalizeResourceDefinition(definition, { modules: modulesManifest.modules });
		const planned = planResourceFiles(config, ir, modulesManifest);
		const paths = planned.map((file) => file.relativePath);
		expect(paths).toContain("apps/api/src/modules/sample-resource/sample-resource.repository.generated.ts");
		expect(paths).toContain("packages/shared/src/schemas/domain/sample-resource.generated.ts");
		expect(paths).toContain("apps/admin/app/(panel)/sample-resource/sample-resource-view.generated.tsx");
	});

	it("skips UI files when scope.ui is empty", () => {
		const config = loadProjectConfig(process.cwd());
		const modulesManifest = buildGeneratorModulesManifest(config.rootDir);
		const definition = parseResourceDefinitionSource(API_ONLY_SAMPLE, "api-only-resource.resource.ts");
		const ir = normalizeResourceDefinition(definition, { modules: modulesManifest.modules });
		const planned = planResourceFiles(config, ir, modulesManifest);
		const paths = planned.map((file) => file.relativePath);
		expect(paths.some((filePath) => filePath.includes("apps/admin/"))).toBe(false);
		expect(paths).toContain("apps/api/src/modules/api-only-resource/api-only-resource.repository.generated.ts");
	});
});
