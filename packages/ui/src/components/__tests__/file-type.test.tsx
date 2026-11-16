// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { FileType } from "../file-type";

// The resolution rules (getFileType, getFileTypeCategory) are @workspace/ui-kit-logic's: file-type/__tests__.

afterEach((): void => {
	cleanup();
});

function renderFileType(element: React.ReactElement): HTMLElement {
	render(element, { wrapper: UiKitTestProviders });
	return screen.getByRole("img");
}

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
