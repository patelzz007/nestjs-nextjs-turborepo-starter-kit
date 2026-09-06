import type { ResourceIR } from "../../ir/types.js";

export function renderRepositoryTest(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	return `import { describe, expect, it } from "vitest";

import { Generated${model}Repository } from "../${slug}.repository.generated";

describe("Generated${model}Repository", () => {
\tit("is defined", () => {
\t\texpect(Generated${model}Repository).toBeDefined();
\t});
});
`;
}
