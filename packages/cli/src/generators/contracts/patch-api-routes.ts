import { readFile, writeFile } from "node:fs/promises";

import { insertBeforeAnchor } from "../../core/patch-insert";
import type { ResourceIR } from "../../ir/types";

const BEGIN = "// @app-generated:begin";
const END = "// @app-generated:end";

function buildRouteBlock(ir: ResourceIR): string {
	const key = ir.resource.contractKey;
	const transitionRoute = ir.workflow ? `\n\t\ttransition: { path: "/${ir.resource.slug}/:id/transitions/:transition", params: ["id", "transition"] },` : "";
	return `\t${key}: {\n\t\tlist: "/${ir.resource.slug}",\n\t\tdetail: { path: "/${ir.resource.slug}/:id", params: ["id"] },\n\t\tcreate: "/${ir.resource.slug}",\n\t\tbulkCreate: "/${ir.resource.slug}/bulk",\n\t\tbulkDelete: "/${ir.resource.slug}/bulk-delete",\n\t\tupdate: { path: "/${ir.resource.slug}/:id", params: ["id"] },\n\t\tdelete: { path: "/${ir.resource.slug}/:id", params: ["id"] },\n\t\trestore: { path: "/${ir.resource.slug}/:id/restore", params: ["id"] },${transitionRoute}\n\t},`;
}

export async function patchApiRoutes(routesPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(routesPath, "utf8");
	const key = ir.resource.contractKey;
	const marker = `${BEGIN} ${key}`;
	const endMarker = `${END} ${key}`;
	const block = buildRouteBlock(ir);
	const wrapped = `${marker}\n${block}\n\t${endMarker}`;

	if (current.includes(marker)) {
		const start = current.indexOf(marker);
		const end = current.indexOf(endMarker);
		const next = `${current.slice(0, start)}${wrapped}${current.slice(end + endMarker.length)}`;
		await writeFile(routesPath, next, "utf8");
		return;
	}

	const next = insertBeforeAnchor(current, "\n} satisfies Record<string, RouteTree>;", wrapped);
	await writeFile(routesPath, next, "utf8");
}
