import type { ResourceIR } from "../../ir/types.js";

export function renderNestControllerWrapper(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	return `import { Generated${model}Controller } from "./${slug}.controller.generated";

/** Developer-owned controller extension point. Routes inherit from the generated base. */
export class ${model}Controller extends Generated${model}Controller {}
`;
}
