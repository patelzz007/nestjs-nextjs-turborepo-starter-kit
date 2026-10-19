import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { gzipSize, readExpoBundleSizes, sumGzipSizes } from "../sizes.mjs";

/** A trimmed copy of the `metadata.json` `expo export` wrote (ios as exported; android in the same shape). */
const EXPORT_DIR = path.join(import.meta.dirname, "fixtures", "expo-export");

describe("gzipSize", () => {
	it("is the length of the default-level gzip of the bytes", () => {
		const bytes = Buffer.from("export const chart = () => null;\n".repeat(200));
		expect(gzipSize(bytes)).toBe(gzipSync(bytes).byteLength);
		expect(gzipSize(bytes)).toBeLessThan(bytes.byteLength);
	});
});

describe("sumGzipSizes", () => {
	const contents = new Map([
		["a.js", Buffer.from("a".repeat(5_000))],
		["b.js", Buffer.from("function b() { return 'b'; }\n".repeat(100))],
	]);
	const readBytes = async (file) => {
		const bytes = contents.get(file);
		if (bytes === undefined) {
			throw new Error(`ENOENT: ${file}`);
		}
		return bytes;
	};

	it("adds each file's own gzip size", async () => {
		const expected = gzipSync(contents.get("a.js")).byteLength + gzipSync(contents.get("b.js")).byteLength;
		await expect(sumGzipSizes(["a.js", "b.js"], readBytes)).resolves.toBe(expected);
	});

	it("counts a file listed twice once", async () => {
		await expect(sumGzipSizes(["a.js", "b.js", "a.js"], readBytes)).resolves.toBe(await sumGzipSizes(["a.js", "b.js"], readBytes));
	});

	it("is zero for no files", async () => {
		await expect(sumGzipSizes([], readBytes)).resolves.toBe(0);
	});

	it("fails when a listed chunk is missing from the build", async () => {
		await expect(sumGzipSizes(["missing.js"], readBytes)).rejects.toThrow(/ENOENT/);
	});
});

describe("readExpoBundleSizes", () => {
	const readText = (file) => readFile(file, "utf8");
	const sizes = new Map([
		[path.join(EXPORT_DIR, "_expo/static/js/ios/index-dcab0ec67727c720b93159b98a1b9163.hbc"), 7_362_160],
		[path.join(EXPORT_DIR, "_expo/static/js/android/index-3f1c0de2a4b5c6d7e8f90a1b2c3d4e5f.hbc"), 7_401_000],
	]);
	const fileSize = async (file) => sizes.get(file) ?? Promise.reject(new Error(`ENOENT: ${file}`));

	it("reads each platform's Hermes bundle path from metadata.json and returns its raw size", async () => {
		const result = await readExpoBundleSizes(EXPORT_DIR, ["ios", "android"], { readText, fileSize });
		expect([...result]).toEqual([
			["ios", 7_362_160],
			["android", 7_401_000],
		]);
	});

	it("fails when a platform was not exported", async () => {
		await expect(readExpoBundleSizes(EXPORT_DIR, ["ios", "web"], { readText, fileSize })).rejects.toThrow(/has no web bundle/);
	});

	it("fails when metadata.json has the wrong shape", async () => {
		await expect(readExpoBundleSizes(EXPORT_DIR, ["ios"], { readText: async () => '{ "fileMetadata": { "ios": {} } }', fileSize })).rejects.toThrow();
	});
});
