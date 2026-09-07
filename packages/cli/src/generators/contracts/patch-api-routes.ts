import { readFile, writeFile } from "node:fs/promises";

import { hasGeneratedBlock, removeGeneratedBlock, upsertGeneratedBlock } from "../../core/generated-marker";
import type { ResourceIR } from "../../ir/types";

function buildRouteBlock(ir: ResourceIR): string {
	const key = ir.resource.contractKey;
	const transitionRoute = ir.workflow ? `\n\t\ttransition: { path: "/${ir.resource.slug}/:id/transitions/:transition", params: ["id", "transition"] },` : "";
	const restoreRoute = ir.softDelete ? `\n\t\trestore: { path: "/${ir.resource.slug}/:id/restore", params: ["id"] },` : "";
	return `\t${key}: {\n\t\tlist: "/${ir.resource.slug}",\n\t\tdetail: { path: "/${ir.resource.slug}/:id", params: ["id"] },\n\t\tcreate: "/${ir.resource.slug}",\n\t\tbulkCreate: "/${ir.resource.slug}/bulk",\n\t\tbulkDelete: "/${ir.resource.slug}/bulk-delete",\n\t\tupdate: { path: "/${ir.resource.slug}/:id", params: ["id"] },\n\t\tdelete: { path: "/${ir.resource.slug}/:id", params: ["id"] },${restoreRoute}${transitionRoute}\n\t},`;
}

export async function patchApiRoutes(routesPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(routesPath, "utf8");
	const key = ir.resource.contractKey;
	const block = buildRouteBlock(ir);
	const anchor = "\n} satisfies Record<string, RouteTree>;";
	const anchorIndex = current.indexOf(anchor);
	if (anchorIndex === -1) {
		throw new Error(`patchApiRoutes: anchor not found in ${routesPath}`);
	}
	const next = upsertGeneratedBlock(current, key, block, anchorIndex, { linePrefix: "\t" });
	await writeFile(routesPath, next, "utf8");
}

/** Removes a resource route block from api-routes.ts during rollback. */
export async function unpatchApiRoutes(routesPath: string, contractKey: string): Promise<void> {
	const current = await readFile(routesPath, "utf8");
	if (!hasGeneratedBlock(current, contractKey)) {
		return;
	}
	await writeFile(routesPath, removeGeneratedBlock(current, contractKey), "utf8");
}
