import type { ResourceIR } from "../../ir/types.js";

export function renderAdminPage(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	return `import ${model}View from "./${ir.resource.slug}-view.generated";

export const dynamic = "force-dynamic";

export default function ${model}Page(): React.JSX.Element {
\treturn <${model}View />;
}
`;
}
