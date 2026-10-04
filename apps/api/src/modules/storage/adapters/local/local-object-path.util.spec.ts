import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { InvalidLocalObjectPathError, resolveLocalObjectPath } from "./local-object-path.util";

const ROOT = resolve("/srv/app/.object-storage");

describe("resolveLocalObjectPath", () => {
	it("maps a container and key inside the root", () => {
		expect(resolveLocalObjectPath(ROOT, "local-private-bucket", "kyb/org-1/doc 1.pdf")).toBe(join(ROOT, "local-private-bucket", "kyb", "org-1", "doc 1.pdf"));
	});

	it.each([
		["parent traversal in the key", "local-private-bucket", "../../.env"],
		["traversal hidden mid-key", "local-private-bucket", "kyb/../../../apps/api/.env"],
		["a dot segment", "local-private-bucket", "kyb/./doc.pdf"],
		["an absolute key", "local-private-bucket", "/etc/passwd"],
		["a backslash", "local-private-bucket", "kyb\\..\\..\\.env"],
		["a NUL byte", "local-private-bucket", "kyb/doc.pdf\0.png"],
		["an empty segment", "local-private-bucket", "kyb//doc.pdf"],
		["an empty key", "local-private-bucket", ""],
		["a parent container", "..", ".env"],
		["a container with a slash", "local-private-bucket/..", ".env"],
		["an absolute container", "/etc", "passwd"],
		["an uppercase container", "Local", "doc.pdf"],
	])("rejects %s", (_label: string, container: string, key: string) => {
		expect(() => resolveLocalObjectPath(ROOT, container, key)).toThrow(InvalidLocalObjectPathError);
	});
});
