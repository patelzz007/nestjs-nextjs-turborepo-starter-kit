import type { ResourceIR } from "../../ir/types";

export function renderServiceTest(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	return `import { describe, expect, it } from "vitest";

import { ${model}Service } from "../${slug}.service";

describe("${model}Service", () => {
\tit("is defined", () => {
\t\texpect(${model}Service).toBeDefined();
\t});
});
`;
}
