import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { FileContentStore, UnsafePathError } from "../content-store.ts";

describe("FileContentStore", () => {
	let store: FileContentStore;

	beforeEach(async () => {
		store = new FileContentStore(await mkdtemp(path.join(tmpdir(), "docs-sync-")));
	});

	it("writes, reads, lists and removes a file", async () => {
		await store.write("docs/a/b.md", "Hello");

		await expect(store.read("docs/a/b.md")).resolves.toBe("Hello");
		await expect(store.list("docs/a")).resolves.toEqual(["docs/a/b.md"]);

		await store.remove("docs/a/b.md");
		await expect(store.read("docs/a/b.md")).resolves.toBeNull();
	});

	it("answers null and an empty list for what does not exist", async () => {
		await expect(store.read("docs/none.md")).resolves.toBeNull();
		await expect(store.list("docs/none")).resolves.toEqual([]);
	});

	it.each(["../outside.md", "docs/../../outside.md", "/etc/passwd"])("refuses a path that leaves the repository: %s", async (file) => {
		await expect(store.write(file, "x")).rejects.toBeInstanceOf(UnsafePathError);
	});
});
