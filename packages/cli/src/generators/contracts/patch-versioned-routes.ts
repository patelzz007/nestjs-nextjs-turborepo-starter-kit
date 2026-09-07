import { readFile, writeFile } from "node:fs/promises";

import { hasGeneratedBlock, removeGeneratedBlock, upsertGeneratedBlock } from "../../core/generated-marker";
import type { ResourceIR } from "../../ir/types";

function buildVersionedRouteBlock(ir: ResourceIR): string {
	return `\t"/${ir.resource.slug}",`;
}

function insertRouteBeforeCapabilitiesCatalog(content: string, routeLine: string): string {
	const typeAnchor = `\t"/capabilities/catalog",\n] = [`;
	const typeIndex = content.indexOf(typeAnchor);
	if (typeIndex === -1) {
		throw new Error("patchVersionedRoutes: type tuple anchor not found");
	}
	let next = `${content.slice(0, typeIndex)}${routeLine}\n${content.slice(typeIndex)}`;

	const runtimeAnchor = `\t"/capabilities/catalog",\n];`;
	const runtimeIndex = next.indexOf(runtimeAnchor);
	if (runtimeIndex === -1) {
		throw new Error("patchVersionedRoutes: runtime array anchor not found");
	}
	next = `${next.slice(0, runtimeIndex)}${routeLine}\n${next.slice(runtimeIndex)}`;
	return next;
}

export async function patchVersionedRoutes(versioningPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(versioningPath, "utf8");
	const markerKey = `route:${ir.resource.slug}`;
	const routeEntry = `\t"/${ir.resource.slug}",`;
	if (current.includes(routeEntry) || hasGeneratedBlock(current, markerKey)) {
		return;
	}
	const block = buildVersionedRouteBlock(ir);
	const markerWrapped = upsertGeneratedBlock("", markerKey, block, 0, { linePrefix: "\t" });
	const routeLine = markerWrapped.trim();
	const next = insertRouteBeforeCapabilitiesCatalog(current, routeLine);
	await writeFile(versioningPath, next, "utf8");
}

/** Removes a versioned route entry during rollback. */
export async function unpatchVersionedRoutes(versioningPath: string, slug: string): Promise<void> {
	const current = await readFile(versioningPath, "utf8");
	const markerKey = `route:${slug}`;
	let next = current;
	if (hasGeneratedBlock(next, markerKey)) {
		next = removeGeneratedBlock(next, markerKey);
	}
	const routeLine = `\t"/${slug}",`;
	next = next.replace(`${routeLine}\n`, "");
	await writeFile(versioningPath, next, "utf8");
}
