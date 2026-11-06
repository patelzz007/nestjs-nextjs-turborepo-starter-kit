import type { Node } from "constructs";
import { z } from "zod";

const ContextStringSchema = z.string();

/** Read a string CDK context value (`-c key=value`) with safe parsing. */
export function readContextString(node: Node, key: string): string | undefined {
	const parsed = ContextStringSchema.safeParse(node.tryGetContext(key));
	return parsed.success ? parsed.data : undefined;
}

/** Parse a comma-separated CDK context string into trimmed origin URLs. */
export function readContextStringList(node: Node, key: string): readonly string[] {
	const raw = readContextString(node, key);
	if (raw === undefined || raw.length === 0) {
		return [];
	}
	return raw
		.split(",")
		.map((origin: string): string => origin.trim())
		.filter((origin: string): boolean => origin.length > 0);
}
