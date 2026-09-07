import type { ResourceIR } from "../../ir/types";

const DEFAULT_LIST_PAGE = 1;
const DEFAULT_LIST_LIMIT = 20;

export function renderAdminPage(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const contractKey = ir.resource.contractKey;
	const slug = ir.resource.slug;
	return `import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readPaginatedTotal } from "@/lib/api-envelope";

import ${model}View from "./${slug}-view.generated";

export const dynamic = "force-dynamic";

export default async function ${model}Page(): Promise<React.JSX.Element> {
\tconst server = createAdminServerCaller();
\tconst result = await Promise.allSettled([
\t\tserver.${contractKey}.list.query({ page: ${DEFAULT_LIST_PAGE}, limit: ${DEFAULT_LIST_LIMIT} }),
\t]);

\tconst first = result[0];
\tconst initialRows = first.status === "fulfilled" ? first.value.data : undefined;
\tconst initialTotal =
\t\tfirst.status === "fulfilled" ? readPaginatedTotal(first.value.meta, first.value.data.length) : undefined;

\treturn <${model}View initialRows={initialRows} initialTotal={initialTotal} />;
}
`;
}
