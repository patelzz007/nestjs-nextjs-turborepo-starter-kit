import type { ResourceIR } from "../../ir/types";

export function renderNestModule(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	return `import { Module } from "@nestjs/common";

import { PlatformResourceModule } from "../../platform/platform-resource.module";

import { ${model}Controller } from "./${slug}.controller";
import { Generated${model}Repository } from "./${slug}.repository.generated";
import { ${model}Service } from "./${slug}.service";

@Module({
	imports: [PlatformResourceModule],
	controllers: [${model}Controller],
	providers: [Generated${model}Repository, ${model}Service],
	exports: [${model}Service],
})
export class ${model}Module {}
`;
}
