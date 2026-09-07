import { readFile, writeFile } from "node:fs/promises";

import { hasGeneratedBlock, removeGeneratedBlock, upsertGeneratedBlock } from "../../core/generated-marker";
import type { ResourceIR } from "../../ir/types";
import { renderListQueryKeyBinding, resolveTitleField } from "../admin/list-filters";

function buildEndpointsBlock(ir: ResourceIR): string {
	const key = ir.resource.contractKey;
	const slug = ir.resource.slug;
	const model = ir.resource.modelName;
	const titleField = resolveTitleField(ir);
	const listQueryKey = renderListQueryKeyBinding(ir, slug);
	const transitionMutation = ir.workflow
		? `\n\t\ttransition: defineMutation(apiContract.${key}.transition, {\n\t\t\tresponse: envelope(${model}Schema),\n\t\t\tqueryKey: ({ id, transition }) => ["${slug}", "transition", id, transition],\n\t\t}),`
		: "";
	const restoreMutation = ir.softDelete
		? `\n\t\trestore: defineMutation(apiContract.${key}.restore, {\n\t\t\tresponse: envelope(${model}Schema),\n\t\t\tqueryKey: ({ id }) => ["${slug}", "restore", id],\n\t\t}),`
		: "";
	return `\t${key}: {\n\t\tlist: defineQuery(apiContract.${key}.list, {\n\t\t\tresponse: envelope(z.array(${model}Schema), ApiPaginatedMetaSchema),\n\t\t\tqueryKey: ({ ${listQueryKey.destructure} }) => ${listQueryKey.array},\n\t\t}),\n\t\tdetail: defineQuery(apiContract.${key}.detail, {\n\t\t\tresponse: envelope(${model}Schema),\n\t\t\tqueryKey: ({ id }) => ["${slug}", "detail", id],\n\t\t}),\n\t\tcreate: defineMutation(apiContract.${key}.create, {\n\t\t\tresponse: envelope(${model}Schema),\n\t\t\tqueryKey: ({ ${titleField} }) => ["${slug}", "create", ${titleField}],\n\t\t}),\n\t\tbulkCreate: defineMutation(apiContract.${key}.bulkCreate, {\n\t\t\tresponse: envelope(z.array(${model}Schema)),\n\t\t\tqueryKey: ({ items }) => ["${slug}", "bulk-create", String(items.length)],\n\t\t}),\n\t\tbulkDelete: defineMutation(apiContract.${key}.bulkDelete, {\n\t\t\tresponse: envelope(BulkDeleteResultSchema),\n\t\t\tqueryKey: ({ ids }) => ["${slug}", "bulk-delete", ...ids],\n\t\t}),\n\t\tupdate: defineMutation(apiContract.${key}.update, {\n\t\t\tresponse: envelope(${model}Schema),\n\t\t\tqueryKey: ({ id }) => ["${slug}", "update", id],\n\t\t}),\n\t\tdelete: defineMutation(apiContract.${key}.delete, {\n\t\t\tresponse: envelope(DeleteSuccessDataSchema),\n\t\t\tqueryKey: ({ id }) => ["${slug}", "delete", id],\n\t\t}),${restoreMutation}${transitionMutation}\n\t},`;
}

export async function patchEndpoints(endpointsPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(endpointsPath, "utf8");
	const key = ir.resource.contractKey;
	const model = ir.resource.modelName;
	const block = buildEndpointsBlock(ir);

	const schemaImport = `\t${model}Schema,`;
	let working = current;
	if (!working.includes(schemaImport)) {
		const anchor = "\tRewardResponseSchema,\n";
		if (!working.includes(anchor)) {
			throw new Error(`patchEndpoints: schema import anchor not found in ${endpointsPath}`);
		}
		working = working.replace(anchor, `${anchor}${schemaImport}`);
	}

	const bulkDeleteResultImport = "\tBulkDeleteResultSchema,\n";
	if (!working.includes(bulkDeleteResultImport)) {
		const anchor = "\tDeleteSuccessDataSchema,\n";
		if (!working.includes(anchor)) {
			throw new Error(`patchEndpoints: bulk delete import anchor not found in ${endpointsPath}`);
		}
		working = working.replace(anchor, `${anchor}${bulkDeleteResultImport}`);
	}

	if (working !== current) {
		await writeFile(endpointsPath, working, "utf8");
	}

	const refreshed = await readFile(endpointsPath, "utf8");
	const anchor = "\n} as const;\n\n/** The full router tree";
	const anchorIndex = refreshed.indexOf(anchor);
	if (anchorIndex === -1 && !hasGeneratedBlock(refreshed, key)) {
		throw new Error(`patchEndpoints: block anchor not found in ${endpointsPath}`);
	}
	const insertIndex = anchorIndex === -1 ? refreshed.length : anchorIndex;
	const next = upsertGeneratedBlock(refreshed, key, block, insertIndex, { linePrefix: "\t" });
	await writeFile(endpointsPath, next, "utf8");
}

/** Removes a resource endpoints block during rollback. */
export async function unpatchEndpoints(endpointsPath: string, contractKey: string): Promise<void> {
	const current = await readFile(endpointsPath, "utf8");
	if (!hasGeneratedBlock(current, contractKey)) {
		return;
	}
	await writeFile(endpointsPath, removeGeneratedBlock(current, contractKey), "utf8");
}
