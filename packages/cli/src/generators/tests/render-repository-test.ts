import type { ResourceIR } from "../../ir/types";

export function renderRepositoryTest(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	return `import { describe, expect, it } from "vitest";

import { Generated${model}Repository } from "../${slug}.repository.generated";

describe("Generated${model}Repository", () => {
\tit("exposes list and findById repository methods", () => {
\t\texpect(Generated${model}Repository.prototype.list).toBeDefined();
\t\texpect(Generated${model}Repository.prototype.findById).toBeDefined();
\t});

\tit("exposes create and delete repository methods", () => {
\t\texpect(Generated${model}Repository.prototype.create).toBeDefined();
\t\texpect(Generated${model}Repository.prototype.delete).toBeDefined();
\t});
});
`;
}
