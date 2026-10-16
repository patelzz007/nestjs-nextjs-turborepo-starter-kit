// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { FILE_TYPE_CATEGORIES, FILE_TYPE_EXTENSION_NAMES, FileType, getFileType, getFileTypeCategory } from "../file-type";

afterEach((): void => {
	cleanup();
});

function renderFileType(element: React.ReactElement): HTMLElement {
	render(element, { wrapper: UiKitTestProviders });
	return screen.getByRole("img");
}

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

describe("FileType", () => {
	it("is an image named after the type, with the extension label", (): void => {
		const icon = renderFileType(<FileType type="pdf" />);
		expect(icon.getAttribute("aria-label")).toBe("PDF file");
		expect(icon.dataset.slot).toBe("file-type");
		expect(icon.dataset.category).toBe("document");
		expect(icon.querySelector("[data-slot=file-type-label]")?.textContent).toBe("PDF");
	});

	it("spells out a shortened label in its name", (): void => {
		const icon = renderFileType(<FileType type="dockerfile" />);
		expect(icon.getAttribute("aria-label")).toBe("DOCKERFILE file");
		expect(icon.querySelector("[data-slot=file-type-label]")?.textContent).toBe("DOCK");
	});

	it("names a family by its category and shows its glyph instead of a label", (): void => {
		const icon = renderFileType(<FileType type="image" />);
		expect(icon.getAttribute("aria-label")).toBe("Image");
		expect(icon.querySelector("[data-slot=file-type-glyph]")).not.toBeNull();
		expect(icon.querySelector("[data-slot=file-type-label]")).toBeNull();
	});

	it("adds a custom string label to the name", (): void => {
		const icon = renderFileType(<FileType type="docx" label="v3" />);
		expect(icon.getAttribute("aria-label")).toBe("v3, DOCX file");
		expect(icon.querySelector("[data-slot=file-type-label]")?.textContent).toBe("v3");
	});

	it("hides the label for a null label and for glyph mode", (): void => {
		const hidden = renderFileType(<FileType type="csv" label={null} />);
		expect(hidden.querySelector("[data-slot=file-type-label]")).toBeNull();
		cleanup();
		const glyph = renderFileType(<FileType type="csv" glyph />);
		expect(glyph.querySelector("[data-slot=file-type-glyph]")).not.toBeNull();
	});

	it("draws a custom icon in place of the glyph and label", (): void => {
		const icon = renderFileType(<FileType type="pdf" icon={<svg data-testid="lock" />} />);
		expect(icon.querySelector("[data-slot=file-type-custom-icon] [data-testid=lock]")).not.toBeNull();
		expect(icon.querySelector("[data-slot=file-type-label]")).toBeNull();
	});

	it("colours a type with its tone token, and mono with the muted token", (): void => {
		const toned = renderFileType(<FileType type="xlsx" />);
		expect(toned.dataset.tone).toBe("green");
		expect(toned.className).toContain("text-tone-green");
		cleanup();
		const mono = renderFileType(<FileType type="xlsx" variant="mono" />);
		expect(mono.dataset.variant).toBe("mono");
		expect(mono.className).toContain("text-muted-foreground");
	});

	it("renders an unknown extension as a neutral file with its label", (): void => {
		const icon = renderFileType(<FileType type="xyz" />);
		expect(icon.dataset.tone).toBe("neutral");
		expect(icon.getAttribute("aria-label")).toBe("XYZ file");
	});

	it("applies the size variant", (): void => {
		const icon = renderFileType(<FileType type="pdf" size="mini" />);
		expect(icon.dataset.size).toBe("mini");
		expect(icon.className).toContain("[--file-type-size:--spacing(4.5)]");
	});

	it("uses a per-usage label override", (): void => {
		const icon = renderFileType(<FileType type="pdf" labels={{ typeFile: (type: string): string => `Fichier ${type}` }} />);
		expect(icon.getAttribute("aria-label")).toBe("Fichier PDF");
	});

	it("forwards its ref and merges className last", (): void => {
		const ref = React.createRef<HTMLSpanElement>();
		renderFileType(<FileType ref={ref} type="pdf" className="size-20" />);
		expect(ref.current?.dataset.slot).toBe("file-type");
		expect(ref.current?.className).toMatch(/size-20$/);
	});
});
