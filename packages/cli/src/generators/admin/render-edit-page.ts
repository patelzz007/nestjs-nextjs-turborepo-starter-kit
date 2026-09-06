import type { ResourceIR } from "../../ir/types.js";

export function renderAdminEditPage(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	return `interface Edit${model}PageProps {
\treadonly params: Promise<{ id: string }>;
}

export default async function Edit${model}Page({ params }: Edit${model}PageProps): Promise<React.JSX.Element> {
\tconst { id } = await params;
\treturn (
\t\t<div className="space-y-4">
\t\t\t<h1 className="text-2xl font-semibold">Edit ${ir.resource.singular}</h1>
\t\t\t<p className="text-muted-foreground">Editing resource {id}</p>
\t\t</div>
\t);
}
`;
}
