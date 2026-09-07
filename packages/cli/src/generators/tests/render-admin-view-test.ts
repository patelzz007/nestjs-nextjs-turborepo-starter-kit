import type { ResourceIR } from "../../ir/types";

export function renderAdminViewTest(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	return `import { describe, expect, it } from "vitest";

describe("${model}View", () => {
\tit("placeholder contract test", () => {
\t\texpect(true).toBe(true);
\t});
});
`;
}
