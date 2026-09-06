import { describe, expect, it } from "vitest";

import { planResourceFiles } from "./planner.js";
import { loadProjectConfig } from "./project.js";
import { normalizeResourceDefinition } from "../ir/normalize.js";
import { parseResourceDefinitionSource } from "../parser/parse-resource-definition.js";

const SAMPLE = `import { defineResource } from "@workspace/cli";

export default defineResource({
	version: 1,
	name: "SampleResource",
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
	workflow: {
		field: "status",
		initial: "draft",
		transitions: { draft: ["published"], published: ["archived"], archived: [] },
	},
	audit: true,
});
`;

describe("planResourceFiles", () => {
	it("plans deterministic generator-owned files", () => {
		const config = loadProjectConfig(process.cwd());
		const definition = parseResourceDefinitionSource(SAMPLE, "sample-resource.resource.ts");
		const ir = normalizeResourceDefinition(definition);
		const planned = planResourceFiles(config, ir);
		const paths = planned.map((file) => file.relativePath);
		expect(paths).toContain("apps/api/src/modules/sample-resource/sample-resource.repository.generated.ts");
		expect(paths).toContain("packages/shared/src/schemas/domain/sample-resource.generated.ts");
		expect(paths).toContain("apps/admin/app/(panel)/sample-resource/sample-resource-view.generated.tsx");
	});
});
