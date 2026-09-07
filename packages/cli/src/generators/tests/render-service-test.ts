import type { ResourceIR } from "../../ir/types";

export function renderServiceTest(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	const transitionAssertion = ir.workflow
		? `\n\tit("exposes workflow transition method", () => {\n\t\texpect(${model}Service.prototype.transition).toBeDefined();\n\t});`
		: "";
	return `import { describe, expect, it } from "vitest";

import { ${model}Service } from "../${slug}.service";

describe("${model}Service", () => {
\tit("exposes CRUD service methods", () => {
\t\texpect(${model}Service.prototype.list).toBeDefined();
\t\texpect(${model}Service.prototype.create).toBeDefined();
\t\texpect(${model}Service.prototype.getById).toBeDefined();
\t\texpect(${model}Service.prototype.update).toBeDefined();
\t\texpect(${model}Service.prototype.delete).toBeDefined();
\t});${transitionAssertion}
});
`;
}
