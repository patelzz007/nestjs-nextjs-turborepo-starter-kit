import type { ResourceIR } from "../../ir/types";

export function renderNestServiceWrapper(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	return `import { Injectable } from "@nestjs/common";

import { Generated${model}Repository } from "./${slug}.repository.generated";
import { Generated${model}Service } from "./${slug}.service.generated";

/** Developer-owned service extension point. */
@Injectable()
export class ${model}Service extends Generated${model}Service {
	public constructor(repository: Generated${model}Repository) {
		super(repository);
	}
}
`;
}
