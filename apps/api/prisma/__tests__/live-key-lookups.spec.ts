import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { unfilteredLiveKeyLookups } from "../live-key-lookups";

const API_ROOT = join(import.meta.dirname, "..", "..");
/** Where queries live: the API's code, the seeds and the database scripts (tests build their own rows). */
const SCANNED = ["src", "prisma", "scripts"];

function sourceFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((name: string): string[] => {
		const path = join(directory, name);
		if (statSync(path).isDirectory()) {
			return name === "__tests__" || name === "node_modules" || name === "migrations" ? [] : sourceFiles(path);
		}
		return name.endsWith(".ts") ? [path] : [];
	});
}

describe("unfilteredLiveKeyLookups", () => {
	it("flags a lookup by a live-only key without isDeleted, with its line", () => {
		const source =
			"const a = 1;\nconst user = await prisma.user.findUnique({ where: { email }, select: { id: true } });\nawait tx.location.findFirst({ where: { tenantId, code: candidate } });";
		expect(unfilteredLiveKeyLookups(source)).toStrictEqual([
			{ line: 2, delegate: "user", field: "email" },
			{ line: 3, delegate: "location", field: "code" },
		]);
	});

	it("accepts the live-only filter, lookups by id, and email only in select or an unrelated model", () => {
		const source = [
			"await prisma.user.findUnique({ where: { email, isDeleted: false } });",
			"await prisma.user.findMany({ where: { email: { in: emails }, isDeleted: false }, select: { id: true } });",
			"await prisma.user.upsert({ where: { id }, create: { id, email }, update: {} });",
			"await prisma.user.findMany({ where: { id: { in: ids } }, select: { email: true } });",
			'await prisma.tenantInvitation.findFirst({ where: { email, status: "PENDING" } });',
		].join("\n");
		expect(unfilteredLiveKeyLookups(source)).toStrictEqual([]);
	});
});

describe("lookups by a live-only key (User.email, Location code)", () => {
	it("always filter isDeleted in the API, the seeds and the scripts", () => {
		const offenders = SCANNED.flatMap((folder) => sourceFiles(join(API_ROOT, folder))).flatMap((path) =>
			unfilteredLiveKeyLookups(readFileSync(path, "utf8")).map((lookup) => `${relative(API_ROOT, path)}:${String(lookup.line)} (${lookup.delegate}.${lookup.field})`),
		);
		expect(offenders).toStrictEqual([]);
	});
});
