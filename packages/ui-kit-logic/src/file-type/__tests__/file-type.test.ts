import { describe, expect, it } from "vitest";

import { FILE_TYPE_CATEGORIES, FILE_TYPE_EXTENSION_NAMES, getFileType, getFileTypeCategory, resolveFileType } from "../file-type";

describe("getFileType", () => {
	it.each([
		["report.pdf", "pdf"],
		["Archive.TAR.GZ", "gz"],
		["src/app/page.tsx", "tsx"],
		["https://cdn.example.com/files/photo.jpeg?v=2#top", "jpeg"],
		["https://example.com", "empty"],
		["invoice #12.pdf", "pdf"],
		["photos/", "folder"],
		["application/pdf", "pdf"],
		["image/svg+xml", "svg"],
		["image/x-unknown", "image"],
		["audio/webm", "audio"],
		["text/plain; charset=utf-8", "txt"],
		["Dockerfile", "dockerfile"],
		["Dockerfile.dev", "dockerfile"],
		["Dockerfile.md", "md"],
		[".env.local", "env"],
		[".prettierignore", "ignore"],
		["go.mod", "go"],
		["LICENSE", "txt"],
		["cert.cer", "crt"],
		["notes", "empty"],
		[".pdf", "pdf"],
		["image", "image"],
		["data.xyz", "xyz"],
		["", "empty"],
	])("resolves %s to %s", (input, expected): void => {
		expect(getFileType(input)).toBe(expected);
	});
});

describe("getFileTypeCategory", () => {
	it("groups any type by its family", (): void => {
		expect(getFileTypeCategory("xlsx")).toBe("spreadsheet");
		expect(getFileTypeCategory(".PNG")).toBe("image");
		expect(getFileTypeCategory("folder")).toBe("folder");
		expect(getFileTypeCategory("xyz")).toBe("file");
		expect(getFileTypeCategory(undefined)).toBe("empty");
	});

	it("exposes the known families and extensions", (): void => {
		expect(FILE_TYPE_CATEGORIES).toContain("presentation");
		expect(FILE_TYPE_CATEGORIES).not.toContain("file");
		expect(FILE_TYPE_EXTENSION_NAMES).toContain("docx");
	});
});

describe("resolveFileType", () => {
	it("reads an extension, a family, an empty type and an unknown one", (): void => {
		expect(resolveFileType(".PDF")).toStrictEqual({ type: "pdf", category: "document", label: "PDF", tone: "orange" });
		expect(resolveFileType("image")).toStrictEqual({ type: "image", category: "image", tone: "violet" });
		expect(resolveFileType(undefined)).toStrictEqual({ type: "empty", category: "empty", tone: "neutral" });
		expect(resolveFileType("step")).toStrictEqual({ type: "step", category: "file", label: "STEP", tone: "neutral" });
	});
});
