import type { ResourceIR } from "../../ir/types.js";

export function renderAdminCreatePage(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	return `export default function Create${model}Page(): React.JSX.Element {
\treturn (
\t\t<div className="space-y-4">
\t\t\t<h1 className="text-2xl font-semibold">Create ${ir.resource.singular}</h1>
\t\t\t<p className="text-muted-foreground">Extend this scaffold with a generated form or custom business rules.</p>
\t\t</div>
\t);
}
`;
}
