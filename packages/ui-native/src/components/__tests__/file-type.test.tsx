import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { DEFAULT_FILE_TYPE_LABELS, FileType, fileTypeLabelFontSize, fileTypeNameOf } from "../file-type";

describe("fileTypeNameOf", () => {
	it("names a type with a label as its file, a family by its category, and a custom label in front", () => {
		expect(fileTypeNameOf("pdf", undefined, DEFAULT_FILE_TYPE_LABELS)).toBe("PDF file");
		expect(fileTypeNameOf("image", undefined, DEFAULT_FILE_TYPE_LABELS)).toBe("Image");
		expect(fileTypeNameOf("dockerfile", undefined, DEFAULT_FILE_TYPE_LABELS)).toBe("DOCKERFILE file");
		expect(fileTypeNameOf("docx", "V3", DEFAULT_FILE_TYPE_LABELS)).toBe("V3, DOCX file");
		expect(fileTypeNameOf("docx", "docx", DEFAULT_FILE_TYPE_LABELS)).toBe("DOCX file");
	});
});

describe("fileTypeLabelFontSize", () => {
	it("reads every label up to 4 characters the same, and shrinks a longer one to fit", () => {
		expect(fileTypeLabelFontSize(40, 3)).toBe(fileTypeLabelFontSize(40, 4));
		expect(fileTypeLabelFontSize(40, 8)).toBeLessThan(fileTypeLabelFontSize(40, 4));
	});
});

describe("FileType", () => {
	it("is one image named after the type, showing its extension label", async () => {
		await render(<FileType type="pdf" />);
		expect(screen.getByRole("image", { name: "PDF file" })).toBeOnTheScreen();
		expect(screen.getByText("PDF")).toBeOnTheScreen();
	});

	it("shows a family's glyph and no label, or the glyph on request", async () => {
		const view = await render(<FileType type="folder" />);
		expect(screen.getByRole("image", { name: "Folder" })).toBeOnTheScreen();
		expect(screen.queryByText("FOLDER")).toBeNull();
		await view.rerender(<FileType type="xlsx" glyph />);
		expect(screen.queryByText("XLSX")).toBeNull();
	});

	it("replaces or hides the label, and draws a custom icon in its place", async () => {
		const view = await render(<FileType type="docx" label="V3" />);
		expect(screen.getByText("V3")).toBeOnTheScreen();
		expect(screen.getByRole("image", { name: "V3, DOCX file" })).toBeOnTheScreen();
		await view.rerender(<FileType type="docx" label={null} />);
		expect(screen.queryByText("DOCX")).toBeNull();
		await view.rerender(<FileType type="docx" icon={<Text>lock</Text>} />);
		expect(screen.getByText("lock")).toBeOnTheScreen();
		expect(screen.queryByText("DOCX")).toBeNull();
	});

	it("paints the label band in the tone, and takes the caller's classes over it", async () => {
		const view = await render(<FileType type="xlsx" />);
		expect(screen.getByText("XLSX")).toHaveProp("className", expect.stringContaining("text-tone-green-soft"));
		await view.rerender(<FileType type="xlsx" tone="teal" labelTextClassName="text-foreground" />);
		expect(screen.getByText("XLSX")).toHaveProp("className", expect.stringContaining("text-foreground"));
		expect(screen.getByText("XLSX")).toHaveProp("className", expect.not.stringContaining("text-tone-teal-soft"));
	});

	it.each([
		["mini", "size-4.5"],
		["md", "size-10"],
		["xl", "size-14"],
	] satisfies [React.ComponentProps<typeof FileType>["size"], string][])("has a %s size (%s)", async (size, sizeClass) => {
		await render(<FileType type="zip" size={size} variant="solid" testID="file" />);
		expect(String(screen.getByTestId("file").props.className).split(" ")).toContain(sizeClass);
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<FileType ref={ref} type="csv" variant="mono" className="mt-1" testID="file" />);
		expect(ref.current).not.toBeNull();
		expect(String(screen.getByTestId("file").props.className).split(" ").at(-1)).toBe("mt-1");
	});

	it("draws every variant at every size, its glyph scaled up on the larger ones", async () => {
		const variants: readonly ("outline" | "solid" | "light" | "mono")[] = ["outline", "solid", "light", "mono"];
		const sizes: readonly ("mini" | "md" | "xl")[] = ["mini", "md", "xl"];
		const types: readonly string[] = ["zip", "image", "audio", "archive", "spreadsheet"];
		for (const variant of variants) {
			for (const size of sizes) {
				for (const type of types) {
					const { unmount } = await render(<FileType type={type} variant={variant} size={size} glyph testID="file" />);
					expect(screen.getByTestId("file")).toBeOnTheScreen();
					await unmount();
				}
			}
		}
	});
});
