import { describe, expect, it } from "vitest";

import { normalizeResourceDefinition } from "../ir/normalize";
import { parseResourceDefinitionSource } from "../parser/parse-resource-definition";

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
	events: { created: true, updated: true, deleted: true },
});
`;

describe("parseResourceDefinitionSource", () => {
	it("parses a restricted object literal", () => {
		const definition = parseResourceDefinitionSource(SAMPLE, "sample.resource.ts");
		expect(definition.name).toBe("SampleResource");
		const ir = normalizeResourceDefinition(definition);
		expect(ir.resource.slug).toBe("sample-resource");
		expect(ir.workflow?.initial).toBe("draft");
	});
});
