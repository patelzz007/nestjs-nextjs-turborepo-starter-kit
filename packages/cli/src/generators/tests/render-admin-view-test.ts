import type { ResourceIR } from "../../ir/types";

export function renderAdminViewTest(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	return `import { describe, expect, it } from "vitest";

import ${model}View from "../${slug}-view.generated";

describe("${model}View", () => {
\tit("exports a default view component", () => {
\t\texpect(${model}View).toBeDefined();
\t\texpect(typeof ${model}View).toBe("function");
\t});
});
`;
}
