import type { ResourceIR } from "../../ir/types";

export function renderAdminDetailPage(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const contractKey = ir.resource.contractKey;
	const slug = ir.resource.slug;
	return `import { createAdminServerCaller } from "@/lib/admin-server-api";

import ${model}DetailView from "../${slug}-detail-view.generated";

interface ${model}DetailPageProps {
\treadonly params: Promise<{ id: string }>;
}

export default async function ${model}DetailPage({ params }: ${model}DetailPageProps): Promise<React.JSX.Element> {
\tconst { id } = await params;
\tconst server = createAdminServerCaller();
\tconst result = await Promise.allSettled([server.${contractKey}.detail.query({ id })]);

\tconst first = result[0];
\tconst initial${model} = first.status === "fulfilled" ? first.value.data : undefined;

\treturn <${model}DetailView id={id} initial${model}={initial${model}\} />;
}
`;
}
