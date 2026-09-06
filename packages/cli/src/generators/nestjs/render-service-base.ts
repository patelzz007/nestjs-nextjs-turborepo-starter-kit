import type { ResourceIR } from "../../ir/types.js";

export function renderNestServiceBase(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	const transitionMethod = ir.workflow
		? `
	public async transition(id: string, transition: ${model}Status, body: { expectedVersion: number; idempotencyKey: string }): Promise<${model}> {
		const current = await this.getById(id);
		const currentStatus = current.status;
		const allowed = this.transitionTargets[currentStatus] ?? [];
		if (!allowed.includes(transition)) {
			throw new NotFoundException("Invalid workflow transition");
		}
		return this.repository.transition(id, body.expectedVersion, transition);
	}
`
		: "";
	const transitionField = ir.workflow
		? `
	protected readonly transitionTargets: Record<string, string[]> = ${JSON.stringify(ir.workflow.transitions)};
`
		: "";

	return `${ir.workflow ? 'import { NotFoundException } from "@nestjs/common";\n\n' : ""}import type { Create${model}Input, ${model}, ${model}ListQuery, Update${model}Input${ir.workflow ? `, ${model}Status` : ""} } from "@workspace/shared";

import { BaseService } from "../../platform/persistence/base.service";

import { Generated${model}Repository } from "./${slug}.repository.generated";

export abstract class Generated${model}Service extends BaseService<
\t${model},
\tCreate${model}Input,
\tUpdate${model}Input,
\t${model}ListQuery,
\tGenerated${model}Repository
> {
${transitionField}
	public constructor(repository: Generated${model}Repository) {
		super(repository);
	}
${transitionMethod}
}
`;
}
