import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../../../");

const MUTATION_DECORATOR = /@(?:Post|Put|Patch|Delete)\b/;
const COVERED_DECORATOR = /@(?:RateLimit|Throttle|SkipThrottle|SkipAuthThrottle|SkipRateLimit)\b|UseGuards\(ThrottlerGuard\)/;

function controllerFiles(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory)) {
		const fullPath = path.join(directory, entry);
		if (statSync(fullPath).isDirectory()) {
			if (entry === "node_modules" || entry === "dist") {
				continue;
			}
			found.push(...controllerFiles(fullPath));
			continue;
		}
		if (entry.endsWith(".controller.ts")) {
			found.push(fullPath);
		}
	}
	return found;
}

function uncoveredMutations(source: string): number[] {
	const lines = source.split("\n");
	const missing: number[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (line === undefined || !MUTATION_DECORATOR.test(line)) {
			continue;
		}
		const block: string[] = [line];
		let cursor = index - 1;
		while (cursor >= 0) {
			const previous = lines[cursor];
			if (previous === undefined || previous.trim() === "") {
				break;
			}
			if (/^\s*@/.test(previous) || /^\s*\/\//.test(previous)) {
				block.push(previous);
				cursor -= 1;
				continue;
			}
			break;
		}
		let forward = index + 1;
		while (forward < lines.length) {
			const following = lines[forward];
			if (following === undefined || following.trim() === "") {
				break;
			}
			if (/^\s*@/.test(following) || /^\s*\/\//.test(following)) {
				block.push(following);
				forward += 1;
				continue;
			}
			break;
		}
		if (!COVERED_DECORATOR.test(block.join("\n"))) {
			missing.push(index + 1);
		}
	}
	return missing;
}

describe("mutation routes declare a rate-limit policy", () => {
	it("every POST, PUT, PATCH and DELETE has @RateLimit, an explicit skip, or its own ThrottlerGuard", () => {
		const offenders: string[] = [];
		for (const filePath of controllerFiles(path.join(API_ROOT, "src"))) {
			const missing = uncoveredMutations(readFileSync(filePath, "utf8"));
			if (missing.length > 0) {
				offenders.push(`${path.relative(API_ROOT, filePath)}:${missing.join(",")}`);
			}
		}
		expect(offenders).toEqual([]);
	});
});
