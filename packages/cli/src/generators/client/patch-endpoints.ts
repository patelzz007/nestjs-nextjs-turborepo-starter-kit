import { readFile, writeFile } from "node:fs/promises";

import { insertBeforeAnchor } from "../../core/patch-insert.js";
import type { ResourceIR } from "../../ir/types.js";

const BEGIN = "// @app-generated:begin";
const END = "// @app-generated:end";

function buildEndpointsBlock(ir: ResourceIR): string {
	const key = ir.resource.contractKey;
	const slug = ir.resource.slug;
	const model = ir.resource.modelName;
	const transitionMutation = ir.workflow
		? `\n\t\ttransition: defineMutation(apiContract.${key}.transition, {\n\t\t\tresponse: envelope(${model}Schema),\n\t\t\tqueryKey: ({ id, transition }) => ["${slug}", "transition", id, transition],\n\t\t}),`
		: "";
	return `\t${key}: {\n\t\tlist: defineQuery(apiContract.${key}.list, {\n\t\t\tresponse: envelope(z.array(${model}Schema), ApiPaginatedMetaSchema),\n\t\t\tqueryKey: ({ page, limit, sortBy, sortDirection, search }) => ["${slug}", "list", page, limit, sortBy, sortDirection, search],\n\t\t}),\n\t\tdetail: defineQuery(apiContract.${key}.detail, {\n\t\t\tresponse: envelope(${model}Schema),\n\t\t\tqueryKey: ({ id }) => ["${slug}", "detail", id],\n\t\t}),\n\t\tcreate: defineMutation(apiContract.${key}.create, {\n\t\t\tresponse: envelope(${model}Schema),\n\t\t\tqueryKey: ({ name }) => ["${slug}", "create", name],\n\t\t}),\n\t\tupdate: defineMutation(apiContract.${key}.update, {\n\t\t\tresponse: envelope(${model}Schema),\n\t\t\tqueryKey: ({ id }) => ["${slug}", "update", id],\n\t\t}),\n\t\tdelete: defineMutation(apiContract.${key}.delete, {\n\t\t\tresponse: envelope(z.object({ success: z.boolean() }).strict()),\n\t\t\tqueryKey: ({ id }) => ["${slug}", "delete", id],\n\t\t}),\n\t\trestore: defineMutation(apiContract.${key}.restore, {\n\t\t\tresponse: envelope(${model}Schema),\n\t\t\tqueryKey: ({ id }) => ["${slug}", "restore", id],\n\t\t}),${transitionMutation}\n\t},`;
}

export async function patchEndpoints(endpointsPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(endpointsPath, "utf8");
	const key = ir.resource.contractKey;
	const model = ir.resource.modelName;
	const marker = `${BEGIN} ${key}`;
	const endMarker = `${END} ${key}`;
	const block = buildEndpointsBlock(ir);
	const wrapped = `${marker}\n${block}\n\t${endMarker}`;

	const schemaImport = `\t${model}Schema,`;
	if (!current.includes(schemaImport)) {
		const anchor = "\tRewardResponseSchema,\n";
		const withImport = current.replace(anchor, `${anchor}${schemaImport}`);
		await writeFile(endpointsPath, withImport, "utf8");
	}

	const refreshed = await readFile(endpointsPath, "utf8");
	if (refreshed.includes(marker)) {
		const start = refreshed.indexOf(marker);
		const end = refreshed.indexOf(endMarker);
		const next = `${refreshed.slice(0, start)}${wrapped}${refreshed.slice(end + endMarker.length)}`;
		await writeFile(endpointsPath, next, "utf8");
		return;
	}

	const next = insertBeforeAnchor(refreshed, "\n} as const;\n\n/** The full router tree", wrapped);
	await writeFile(endpointsPath, next, "utf8");
}
