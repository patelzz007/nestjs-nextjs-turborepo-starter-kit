// @vitest-environment jsdom
import { act, cleanup, fireEvent, render as renderUnwrapped, screen, waitFor, type RenderOptions, type RenderResult } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
	CodeBlock,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockDownloadButton,
	CodeBlockExpandButton,
	CodeBlockHeader,
	CodeBlockLanguage,
	CodeBlockLineActions,
	CodeBlockTitle,
	CodeBlockWrapToggle,
	markdownCodeProps,
	markdownFences,
	useCodeBlockConfig,
	useCodeBlockFolding,
	useCodeBlockSelection,
	type CodeBlockLabels,
	type CodeBlockLine,
	type CodeBlockLineActionContext,
} from "./code-block";
import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";

const LABELS = UI_KIT_LABELS_EN.codeBlock;

/** Every block renders under the app root's label provider, as in an app. */
function render(ui: React.ReactElement, options?: Omit<RenderOptions, "wrapper">): RenderResult {
	return renderUnwrapped(ui, { ...options, wrapper: UiKitTestProviders });
}

const LINES: CodeBlockLine[] = [
	{ number: 1, text: "const answer = 42;", tokens: [{ content: "const", color: "#d73a49", colorDark: "#ff7b72" }, { content: " answer = 42;" }] },
	{ number: 2, text: "", tokens: [] },
	{ number: 3, text: "return", tokens: [{ content: "return", fontStyle: "italic", word: true }], state: { highlighted: true } },
];

const FIVE_LINES = "one\ntwo\nthree\nfour\nfive";
const FOLDABLE = "function a() {\n  if (x) {\n    return 1;\n  }\n}";

function rows(container: HTMLElement): HTMLElement[] {
	return [...container.querySelectorAll<HTMLElement>("[data-slot=code-block-line]")];
}

function row(container: HTMLElement, line: number): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-code-line="${String(line)}"]`);
	if (!element) throw new Error(`No row for line ${String(line)}`);
	return element;
}

function viewport(container: HTMLElement): HTMLElement {
	const element = container.querySelector<HTMLElement>("[data-slot=code-block-viewport]");
	if (!element) throw new Error("No viewport");
	return element;
}

function preventDefault(event: React.MouseEvent): void {
	event.preventDefault();
}

function pre(container: HTMLElement): HTMLPreElement {
	const element = container.querySelector("pre");
	if (!element) throw new Error("No pre");
	return element;
}

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
});

describe("CodeBlock rendering", () => {
	it("renders passed lines as-is, without highlighting, with colours as custom properties", (): void => {
		const { container } = render(<CodeBlock lines={LINES} language="ts" />);
		expect(rows(container)).toHaveLength(3);

		const [keyword] = row(container, 1).querySelectorAll<HTMLElement>("[data-slot=code-block-token]");
		expect(keyword?.style.getPropertyValue("--cb-c")).toBe("#d73a49");
		expect(keyword?.style.getPropertyValue("--cb-cd")).toBe("#ff7b72");
		/* An unstyled token is a bare span with no slot. */
		expect(row(container, 1).querySelectorAll("[data-slot=code-block-token]")).toHaveLength(1);

		expect(row(container, 2).querySelector("br")).not.toBeNull();

		const emphasised = row(container, 3).querySelector<HTMLElement>("[data-slot=code-block-token]");
		expect(emphasised?.style.fontStyle).toBe("italic");
		expect(emphasised?.getAttribute("data-word")).toBe("true");
		expect(row(container, 3).getAttribute("data-highlighted")).toBe("true");
		expect(row(container, 1).hasAttribute("data-highlighted")).toBe(false);
	});

	it("renders plain code when highlighting is off, and names the region from the language", (): void => {
		const { container } = render(<CodeBlock code={"a\nb"} language="tsx" highlight={false} />);
		expect(rows(container).map((element) => element.textContent)).toEqual(["a", "b"]);
		expect(screen.getByRole("region", { name: "tsx code" })).toBe(viewport(container));
		cleanup();
		render(<CodeBlock code="a" />);
		expect(screen.getByRole("region", { name: "Code" })).toBeDefined();
		cleanup();
		render(<CodeBlock code="a" label="Snippet" />);
		expect(screen.getByRole("region", { name: "Snippet" })).toBeDefined();
	});

	it("highlights `code` on the client with shiki", async (): Promise<void> => {
		const { container } = render(<CodeBlock code="const a = 1;" language="ts" highlightedLines={[1]} />);
		/* Plain text is the first paint. */
		expect(row(container, 1).textContent).toBe("const a = 1;");
		await waitFor(
			(): void => {
				expect(row(container, 1).querySelector("[data-slot=code-block-token]")?.getAttribute("style")).toContain("--cb-c");
			},
			{ timeout: 20_000 },
		);
		expect(row(container, 1).getAttribute("data-highlighted")).toBe("true");
	}, 30_000);

	it("marks line numbers on the pre and seeds the counter from startLine", (): void => {
		const { container } = render(<CodeBlock code={"a\nb"} showLineNumbers startLine={10} />);
		expect(pre(container).getAttribute("data-code-line-numbers")).toBe("true");
		expect(pre(container).style.counterReset).toBe("cb-line 9");
		expect(row(container, 11).style.counterReset).toBe("cb-line 10");
		expect(pre(container).style.getPropertyValue("--code-block-gutter-width")).toContain("2ch");
		cleanup();
		const { container: plain } = render(<CodeBlock code="a" />);
		expect(pre(plain).hasAttribute("data-code-line-numbers")).toBe(false);
	});

	it("renders a patch's own gutter labels and diff state", (): void => {
		const lines: CodeBlockLine[] = [
			{ number: 1, text: "@@ -1 +1 @@", tokens: [{ content: "@@ -1 +1 @@" }], state: { level: "info" }, gutter: " ·  ·" },
			{ number: 2, text: "old", tokens: [{ content: "old" }], state: { diff: "remove" }, gutter: " 1   " },
			{ number: 3, text: "new", tokens: [{ content: "new" }], state: { diff: "add" }, gutter: "    1" },
		];
		const { container } = render(<CodeBlock lines={lines} showLineNumbers />);
		expect(container.querySelector("[data-slot=code-block]")?.getAttribute("data-has-diff")).toBe("true");
		expect(row(container, 2).getAttribute("data-diff")).toBe("remove");
		expect(row(container, 3).getAttribute("data-diff")).toBe("add");
		expect(row(container, 3).getAttribute("data-gutter")).toBe("    1");
		expect(row(container, 1).getAttribute("data-level")).toBe("info");
	});

	it("dims unfocused lines in focus mode", (): void => {
		const lines: CodeBlockLine[] = [
			{ number: 1, text: "a", tokens: [{ content: "a" }], state: { focused: true } },
			{ number: 2, text: "b", tokens: [{ content: "b" }] },
		];
		const { container } = render(<CodeBlock lines={lines} />);
		expect(row(container, 1).getAttribute("data-focused")).toBe("true");
		expect(row(container, 1).hasAttribute("data-blurred")).toBe(false);
		expect(row(container, 2).getAttribute("data-blurred")).toBe("true");
	});

	it("renders pre-coloured lines and the ghost variant", (): void => {
		const lines: CodeBlockLine[] = [
			{ number: 1, text: "ok", tokens: [{ content: "ok", color: "var(--code-ansi-green, #16a34a)", colorDark: "var(--code-ansi-green, #4ade80)" }] },
		];
		const { container } = render(<CodeBlock lines={lines} variant="ghost" />);
		expect(container.querySelector("[data-slot=code-block]")?.getAttribute("data-variant")).toBe("ghost");
		expect(container.querySelector("[data-slot=code-block]")?.className).toContain("[--code-block-bg:transparent]");
		expect(row(container, 1).querySelector<HTMLElement>("[data-slot=code-block-token]")?.style.getPropertyValue("--cb-c")).toContain("--code-ansi-green");
	});

	it("shows a caret on the last line while streaming and announces completion once", (): void => {
		const { container, rerender } = render(<CodeBlock code={"a\nb"} streaming />);
		expect(container.querySelector("[data-slot=code-block]")?.getAttribute("data-streaming")).toBe("true");
		expect(viewport(container).getAttribute("aria-busy")).toBe("true");
		expect(row(container, 2).querySelector("[data-slot=code-block-caret]")).not.toBeNull();
		expect(row(container, 1).querySelector("[data-slot=code-block-caret]")).toBeNull();
		expect(screen.getByRole("status").textContent).toBe("");

		rerender(<CodeBlock code={"a\nb\nc"} streaming />);
		expect(screen.getByRole("status").textContent).toBe("");
		rerender(<CodeBlock code={"a\nb\nc"} />);
		expect(screen.getByRole("status").textContent).toBe("Code generation complete, 3 lines.");
		expect(container.querySelector("[data-slot=code-block-caret]")).toBeNull();

		rerender(<CodeBlock code="x" streaming />);
		rerender(<CodeBlock code="x" completeAnnouncement="Fertig" />);
		expect(screen.getByRole("status").textContent).toBe("Fertig");
	});
});

describe("CodeBlock parts forward refs (rule 20)", () => {
	it("forwards every DOM ref to its element", (): void => {
		const root: { current: HTMLDivElement | null } = { current: null };
		const header: { current: HTMLDivElement | null } = { current: null };
		const title: { current: HTMLDivElement | null } = { current: null };
		const language: { current: HTMLSpanElement | null } = { current: null };
		const copy: { current: HTMLElement | null } = { current: null };
		const download: { current: HTMLElement | null } = { current: null };
		const wrap: { current: HTMLElement | null } = { current: null };
		const expand: { current: HTMLElement | null } = { current: null };
		const content: { current: HTMLDivElement | null } = { current: null };

		render(
			<CodeBlock ref={root} code={FIVE_LINES} language="ts" highlight={false} maxLines={2} data-testid="root">
				<CodeBlockHeader ref={header} data-testid="header">
					<CodeBlockTitle ref={title}>main.ts</CodeBlockTitle>
					<CodeBlockLanguage ref={language} />
					<CodeBlockWrapToggle ref={wrap} />
					<CodeBlockDownloadButton ref={download} />
					<CodeBlockCopyButton ref={copy} />
				</CodeBlockHeader>
				<CodeBlockContent ref={content} />
				<CodeBlockExpandButton ref={expand} />
			</CodeBlock>,
		);
		expect(root.current).toBe(screen.getByTestId("root"));
		expect(header.current).toBe(screen.getByTestId("header"));
		expect(title.current?.textContent).toBe("main.ts");
		expect(language.current?.textContent).toBe("typescript");
		expect(copy.current).toBe(screen.getByRole("button", { name: "Copy code" }));
		expect(download.current).toBe(screen.getByRole("button", { name: "Download code" }));
		expect(wrap.current).toBe(screen.getByRole("button", { name: "Wrap" }));
		expect(expand.current).toBe(screen.getByRole("button", { name: "Show more" }));
		expect(content.current?.getAttribute("data-slot")).toBe("code-block-content");
	});
});

describe("CodeBlock chrome", () => {
	it("flags the header on the root and places header controls inline", (): void => {
		const { container } = render(
			<CodeBlock code="a">
				<CodeBlockHeader>
					<CodeBlockCopyButton />
				</CodeBlockHeader>
				<CodeBlockDownloadButton />
			</CodeBlock>,
		);
		expect(container.querySelector("[data-slot=code-block]")?.getAttribute("data-has-header")).toBe("true");
		expect(container.querySelector("[data-slot=code-block-copy]")?.getAttribute("data-position")).toBe("inline");
		const pinned = container.querySelector("[data-slot=code-block-download]");
		expect(pinned?.getAttribute("data-position")).toBe("pinned");
		expect(pinned?.className).toContain("opacity-0");
	});

	it("shows the resolved language, flags unsupported ones and renders nothing without one", (): void => {
		const { container, rerender } = render(
			<CodeBlock code="a" language="klingon" highlight={false}>
				<CodeBlockLanguage />
			</CodeBlock>,
		);
		const badge = container.querySelector("[data-slot=code-block-language]");
		expect(badge?.textContent).toBe("klingon");
		expect(badge?.getAttribute("data-unsupported")).toBe("true");

		rerender(
			<CodeBlock code="a">
				<CodeBlockLanguage />
			</CodeBlock>,
		);
		expect(container.querySelector("[data-slot=code-block-language]")).toBeNull();
	});

	it("throws a helpful error when a part is used outside a CodeBlock", (): void => {
		vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			render(<CodeBlockWrapToggle />);
		}).toThrow("CodeBlockWrapToggle must be used within a CodeBlock");
		expect((): void => {
			render(<CodeBlockContent />);
		}).toThrow("CodeBlockContent must be used within a CodeBlock");
	});
});

describe("CodeBlockCopyButton", () => {
	function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined): void {
		Object.defineProperty(window.navigator, "clipboard", { value: writeText ? { writeText } : undefined, configurable: true });
	}

	afterEach((): void => {
		Reflect.deleteProperty(window.navigator, "clipboard");
	});

	it("copies the source with notation stripped and flips to the copied state", async (): Promise<void> => {
		const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
		stubClipboard(writeText);
		const onCopy = vi.fn<(value: string) => void>();

		render(
			<CodeBlock code={"const a = 1; // [!code ++]\nconst b = 2;"}>
				<CodeBlockCopyButton onCopy={onCopy} alwaysVisible />
			</CodeBlock>,
		);
		const button = screen.getByRole("button", { name: "Copy code" });
		expect(button.className).not.toContain("opacity-0");
		fireEvent.click(button);

		await waitFor((): void => {
			expect(screen.getByRole("button", { name: "Copied" }).getAttribute("data-copied")).toBe("true");
		});
		expect(writeText).toHaveBeenCalledWith("const a = 1;\nconst b = 2;");
		expect(onCopy).toHaveBeenCalledWith("const a = 1;\nconst b = 2;");
	});

	it("falls back to the document text for server-highlighted lines, and prefers an explicit value", async (): Promise<void> => {
		const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
		stubClipboard(writeText);

		const { rerender } = render(
			<CodeBlock lines={LINES}>
				<CodeBlockCopyButton />
			</CodeBlock>,
		);
		fireEvent.click(screen.getByRole("button"));
		await waitFor((): void => {
			expect(writeText).toHaveBeenCalledWith("const answer = 42;\n\nreturn");
		});

		rerender(
			<CodeBlock lines={LINES}>
				<CodeBlockCopyButton value="explicit" timeout={0} />
			</CodeBlock>,
		);
		fireEvent.click(screen.getByRole("button"));
		await waitFor((): void => {
			expect(writeText).toHaveBeenLastCalledWith("explicit");
		});
	});

	it("resets the copied state after the timeout", async (): Promise<void> => {
		vi.useFakeTimers();
		try {
			stubClipboard(vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined));
			render(
				<CodeBlock code="a">
					<CodeBlockCopyButton timeout={500} />
				</CodeBlock>,
			);
			await act(async (): Promise<void> => {
				fireEvent.click(screen.getByRole("button"));
				await Promise.resolve();
			});
			expect(screen.getByRole("button").getAttribute("data-copied")).toBe("true");
			act((): void => {
				vi.advanceTimersByTime(500);
			});
			expect(screen.getByRole("button").hasAttribute("data-copied")).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("reports a rejected write as an Error and flags the button", async (): Promise<void> => {
		const reason = new DOMException("denied", "NotAllowedError");
		stubClipboard(vi.fn<(text: string) => Promise<void>>().mockRejectedValue(reason));
		const onCopyError = vi.fn<(error: Error) => void>();

		render(
			<CodeBlock code="a">
				<CodeBlockCopyButton onCopyError={onCopyError} />
			</CodeBlock>,
		);
		fireEvent.click(screen.getByRole("button"));
		await waitFor((): void => {
			expect(screen.getByRole("button").getAttribute("data-copy-failed")).toBe("true");
		});
		expect(onCopyError).toHaveBeenCalledTimes(1);
		expect(onCopyError.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toBeInstanceOf(Error);
	});

	it("does nothing without a clipboard or without text", (): void => {
		stubClipboard(undefined);
		render(
			<CodeBlock code="a">
				<CodeBlockCopyButton />
			</CodeBlock>,
		);
		fireEvent.click(screen.getByRole("button"));
		expect(screen.getByRole("button").hasAttribute("data-copied")).toBe(false);
	});
});

describe("CodeBlockWrapToggle", () => {
	it("toggles soft wrap uncontrolled and reports changes", (): void => {
		const onWrapChange = vi.fn<(wrap: boolean) => void>();
		const { container } = render(
			<CodeBlock code="a" onWrapChange={onWrapChange}>
				<CodeBlockWrapToggle />
			</CodeBlock>,
		);
		const button = screen.getByRole("button", { name: "Wrap" });
		expect(button.getAttribute("aria-pressed")).toBe("false");
		expect(pre(container).hasAttribute("data-wrap")).toBe(false);

		fireEvent.click(button);
		expect(screen.getByRole("button", { name: "No wrap" }).getAttribute("aria-pressed")).toBe("true");
		expect(pre(container).getAttribute("data-wrap")).toBe("true");
		expect(onWrapChange).toHaveBeenCalledWith(true);
	});

	it("respects a controlled value and a consumer's preventDefault", (): void => {
		const onWrapChange = vi.fn<(wrap: boolean) => void>();
		const { container, rerender } = render(
			<CodeBlock code="a" wrap onWrapChange={onWrapChange}>
				<CodeBlockWrapToggle />
			</CodeBlock>,
		);
		fireEvent.click(screen.getByRole("button", { name: "No wrap" }));
		expect(onWrapChange).toHaveBeenCalledWith(false);
		expect(pre(container).getAttribute("data-wrap")).toBe("true");

		rerender(
			<CodeBlock code="a" defaultWrap={false}>
				<CodeBlockWrapToggle onClick={preventDefault} />
			</CodeBlock>,
		);
		expect(pre(container).hasAttribute("data-wrap")).toBe(false);
		fireEvent.click(screen.getByRole("button"));
		/* Uncontrolled, a plain click would turn wrapping on. */
		expect(pre(container).hasAttribute("data-wrap")).toBe(false);
	});
});

describe("CodeBlockExpandButton", () => {
	it("collapses under maxLines and expands on click", (): void => {
		const onExpandedChange = vi.fn<(expanded: boolean) => void>();
		const { container } = render(
			<CodeBlock code={FIVE_LINES} maxLines={2} onExpandedChange={onExpandedChange}>
				<CodeBlockExpandButton />
			</CodeBlock>,
		);
		expect(viewport(container).style.getPropertyValue("--cb-max-height")).toContain("2 * var(--code-block-line-height)");
		const button = screen.getByRole("button", { name: "Show more" });
		expect(button.getAttribute("aria-expanded")).toBe("false");
		expect(button.getAttribute("aria-controls")).toBe(viewport(container).id);
		expect(container.querySelector("[data-slot=code-block-expand]")?.getAttribute("data-state")).toBe("collapsed");

		fireEvent.click(button);
		expect(screen.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");
		expect(viewport(container).style.getPropertyValue("--cb-max-height")).toBe("");
		expect(pre(container).className).toContain("pb-(--code-block-expand-clearance)");
		expect(onExpandedChange).toHaveBeenCalledWith(true);
	});

	it("renders nothing when the code fits", (): void => {
		render(
			<CodeBlock code="one" maxLines={2}>
				<CodeBlockExpandButton />
			</CodeBlock>,
		);
		expect(screen.queryByRole("button")).toBeNull();
	});
});

describe("Folding", () => {
	it("detects regions from indentation and folds and unfolds them", (): void => {
		const onFoldedChange = vi.fn<(folded: number[]) => void>();
		const { container } = render(<CodeBlock code={FOLDABLE} foldable onFoldedChange={onFoldedChange} />);
		expect(container.querySelector("[data-slot=code-block]")?.getAttribute("data-gutter-channel")).toBe("true");

		const outer = screen.getByRole("button", { name: "Fold lines 1 to 4" });
		expect(screen.getByRole("button", { name: "Fold lines 2 to 3" })).toBeDefined();
		expect(outer.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(outer);
		expect(onFoldedChange).toHaveBeenCalledWith([1]);
		expect(rows(container).map((element) => element.getAttribute("data-code-line"))).toEqual(["1", "5"]);
		const marker = screen.getByRole("button", { name: "Unfold 3 hidden lines" });
		expect(marker.textContent).toBe("... 3 lines");
		expect(screen.getByRole("button", { name: "Unfold lines 1 to 4" }).getAttribute("data-state")).toBe("folded");

		fireEvent.click(marker);
		expect(rows(container)).toHaveLength(5);
	});

	it("numbers labels by displayed line and toggles by source line when startLine is offset", (): void => {
		const { container } = render(<CodeBlock code={FOLDABLE} foldable startLine={20} />);
		fireEvent.click(screen.getByRole("button", { name: "Fold lines 20 to 23" }));
		expect(rows(container).map((element) => element.getAttribute("data-code-line"))).toEqual(["20", "24"]);
		fireEvent.click(screen.getByRole("button", { name: "Unfold 3 hidden lines" }));
		expect(rows(container)).toHaveLength(5);
	});

	it("supports custom regions and controlled folded state", (): void => {
		const onFoldedChange = vi.fn<(folded: number[]) => void>();
		const { container, rerender } = render(<CodeBlock code={FIVE_LINES} foldable foldRegions={[{ start: 2, end: 4 }]} folded={[]} onFoldedChange={onFoldedChange} />);
		fireEvent.click(screen.getByRole("button", { name: "Fold lines 2 to 4" }));
		expect(onFoldedChange).toHaveBeenCalledWith([2]);
		expect(rows(container)).toHaveLength(5);

		rerender(<CodeBlock code={FIVE_LINES} foldable foldRegions={[{ start: 2, end: 4 }]} folded={[2]} onFoldedChange={onFoldedChange} />);
		expect(row(container, 2).textContent).toBe("two... 2 lines");
		expect(rows(container).map((element) => element.getAttribute("data-code-line"))).toEqual(["1", "2", "5"]);
	});

	it("exposes folding through useCodeBlockFolding", (): void => {
		function FoldControls(): React.JSX.Element {
			const { regions, foldedStarts, foldAll, unfoldAll } = useCodeBlockFolding();
			return (
				<div>
					<span data-testid="state">{`${String(regions.length)}:${foldedStarts.join(",")}`}</span>
					<button type="button" onClick={foldAll}>
						all
					</button>
					<button type="button" onClick={unfoldAll}>
						none
					</button>
				</div>
			);
		}
		render(
			<CodeBlock code={FOLDABLE} foldable defaultFolded={[2]}>
				<FoldControls />
			</CodeBlock>,
		);
		expect(screen.getByTestId("state").textContent).toBe("2:2");
		fireEvent.click(screen.getByRole("button", { name: "all" }));
		expect(screen.getByTestId("state").textContent).toBe("2:1,2");
		fireEvent.click(screen.getByRole("button", { name: "none" }));
		expect(screen.getByTestId("state").textContent).toBe("2:");
	});
});

describe("Selection", () => {
	it("is a multiselect listbox: click toggles, shift-click selects a range", (): void => {
		const onSelectedLinesChange = vi.fn<(lines: number[]) => void>();
		const { container } = render(<CodeBlock code={FIVE_LINES} language="txt" selectable onSelectedLinesChange={onSelectedLinesChange} />);
		const listbox = screen.getByRole("listbox", { name: "txt code lines" });
		expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
		expect(screen.getAllByRole("option")).toHaveLength(5);

		fireEvent.click(row(container, 2));
		expect(onSelectedLinesChange).toHaveBeenLastCalledWith([2]);
		expect(row(container, 2).getAttribute("aria-selected")).toBe("true");
		expect(row(container, 2).getAttribute("data-selected")).toBe("true");

		fireEvent.click(row(container, 4), { shiftKey: true });
		expect(onSelectedLinesChange).toHaveBeenLastCalledWith([2, 3, 4]);

		fireEvent.click(row(container, 3));
		expect(onSelectedLinesChange).toHaveBeenLastCalledWith([2, 4]);
	});

	it("does not select when not selectable", (): void => {
		const { container } = render(<CodeBlock code={FIVE_LINES} />);
		expect(screen.queryByRole("listbox")).toBeNull();
		expect(row(container, 1).hasAttribute("role")).toBe(false);
		fireEvent.click(row(container, 1));
		expect(row(container, 1).hasAttribute("data-selected")).toBe(false);
	});

	it("is controllable and speaks source numbers when startLine is offset", (): void => {
		const onSelectedLinesChange = vi.fn<(lines: number[]) => void>();
		const { container } = render(<CodeBlock code={FIVE_LINES} startLine={100} selectable selectedLines={[1]} onSelectedLinesChange={onSelectedLinesChange} />);
		expect(row(container, 100).getAttribute("aria-selected")).toBe("true");
		fireEvent.click(row(container, 102));
		expect(onSelectedLinesChange).toHaveBeenLastCalledWith([1, 3]);
		expect(row(container, 102).getAttribute("aria-selected")).toBe("false");
	});

	it("navigates with the keyboard and toggles in place", (): void => {
		const onSelectedLinesChange = vi.fn<(lines: number[]) => void>();
		const { container } = render(<CodeBlock code={FIVE_LINES} selectable onSelectedLinesChange={onSelectedLinesChange} />);
		// The listbox (not the scroll region) is focusable and owns the active option.
		const region = screen.getByRole("listbox");
		expect(region.getAttribute("tabindex")).toBe("0");
		expect(viewport(container).hasAttribute("tabindex")).toBe(false);
		expect(viewport(container).hasAttribute("aria-activedescendant")).toBe(false);

		fireEvent.keyDown(region, { key: "ArrowDown" });
		expect(region.getAttribute("aria-activedescendant")).toBe(row(container, 1).id);
		expect(row(container, 1).getAttribute("data-active")).toBe("true");

		fireEvent.keyDown(region, { key: "ArrowDown", shiftKey: true });
		expect(region.getAttribute("aria-activedescendant")).toBe(row(container, 2).id);
		fireEvent.keyDown(region, { key: "Enter" });
		expect(onSelectedLinesChange).toHaveBeenLastCalledWith([]);

		fireEvent.keyDown(region, { key: "End" });
		expect(region.getAttribute("aria-activedescendant")).toBe(row(container, 5).id);
		fireEvent.keyDown(region, { key: " " });
		expect(onSelectedLinesChange).toHaveBeenLastCalledWith([5]);
		fireEvent.keyDown(region, { key: "Home" });
		expect(region.getAttribute("aria-activedescendant")).toBe(row(container, 1).id);
		fireEvent.keyDown(region, { key: "ArrowUp" });
		expect(region.getAttribute("aria-activedescendant")).toBe(row(container, 1).id);

		fireEvent.keyDown(region, { key: "Escape" });
		expect(region.hasAttribute("aria-activedescendant")).toBe(false);
	});

	it("exposes selection through useCodeBlockSelection", (): void => {
		function SelectionReadout(): React.JSX.Element {
			const { selectable, selectedLines, clearSelection } = useCodeBlockSelection();
			return (
				<button type="button" onClick={clearSelection}>
					{`${String(selectable)}:${selectedLines.join(",")}`}
				</button>
			);
		}
		render(
			<CodeBlock code={FIVE_LINES} selectable defaultSelectedLines={[3, 1]}>
				<SelectionReadout />
			</CodeBlock>,
		);
		const readout = screen.getByRole("button", { name: "true:1,3" });
		fireEvent.click(readout);
		expect(screen.getByRole("button", { name: "true:" })).toBeDefined();
	});
});

describe("CodeBlockLineActions", () => {
	function renderActions(context: CodeBlockLineActionContext): React.ReactNode {
		return (
			<button type="button" data-testid="action">
				{`add ${String(context.line)}:${context.text}`}
			</button>
		);
	}

	it("renders one action group on the hovered row with that row's context", (): void => {
		const { container } = render(
			<CodeBlock code={FIVE_LINES} startLine={7} selectable>
				<CodeBlockLineActions>{renderActions}</CodeBlockLineActions>
			</CodeBlock>,
		);
		expect(screen.queryByTestId("action")).toBeNull();

		fireEvent.pointerOver(row(container, 8));
		const action = screen.getByTestId("action");
		expect(action.textContent).toBe("add 8:two");
		expect(row(container, 8).contains(action)).toBe(true);
		expect(container.querySelector("[data-slot=code-block-line-actions]")?.getAttribute("data-side")).toBe("end");

		/* An action click is not a selection. */
		fireEvent.click(action);
		expect(row(container, 8).getAttribute("aria-selected")).toBe("false");

		fireEvent.pointerOver(row(container, 10));
		expect(screen.getAllByTestId("action")).toHaveLength(1);
		expect(screen.getByTestId("action").textContent).toBe("add 10:four");

		fireEvent.pointerLeave(pre(container));
		expect(screen.queryByTestId("action")).toBeNull();
	});

	it("tracks focus too and supports the gutter side", (): void => {
		const { container } = render(
			<CodeBlock code={FIVE_LINES}>
				<CodeBlockLineActions side="gutter">{renderActions}</CodeBlockLineActions>
			</CodeBlock>,
		);
		fireEvent.focusIn(row(container, 3));
		expect(row(container, 3).querySelector("[data-slot=code-block-line-actions]")?.getAttribute("data-side")).toBe("gutter");
	});

	it("warns in development when two action groups are mounted", (): void => {
		const warn = vi.spyOn(console, "warn").mockImplementation((): void => undefined);
		render(
			<CodeBlock code="a">
				<CodeBlockLineActions>{renderActions}</CodeBlockLineActions>
				<CodeBlockLineActions>{renderActions}</CodeBlockLineActions>
			</CodeBlock>,
		);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("Two CodeBlockLineActions are mounted"));
	});
});

describe("CodeBlockDownloadButton", () => {
	let createObjectURL: Mock<(blob: Blob) => string>;
	let revokeObjectURL: Mock<(url: string) => void>;

	beforeEach((): void => {
		createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:code");
		revokeObjectURL = vi.fn<(url: string) => void>();
		/* jsdom has no object URLs; install test doubles on the constructor. */
		Object.assign(URL, { createObjectURL, revokeObjectURL });
	});

	it("saves the stripped source under a language-derived filename", async (): Promise<void> => {
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation((): void => undefined);
		const onDownload = vi.fn<(filename: string) => void>();
		render(
			<CodeBlock code={"x = 1 # [!code focus]"} language="py" highlight={false}>
				<CodeBlockDownloadButton onDownload={onDownload} />
			</CodeBlock>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Download code" }));

		expect(onDownload).toHaveBeenCalledWith("code.py");
		expect(click).toHaveBeenCalledTimes(1);
		const blob = createObjectURL.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first];
		expect(await blob?.text()).toBe("x = 1");
		await waitFor(
			(): void => {
				expect(revokeObjectURL).toHaveBeenCalledWith("blob:code");
			},
			{ timeout: 2000 },
		);
	});

	it("uses an explicit filename, and .txt for an unknown language", (): void => {
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation((): void => undefined);
		const onDownload = vi.fn<(filename: string) => void>();
		const { rerender } = render(
			<CodeBlock code="a" language="klingon" highlight={false}>
				<CodeBlockDownloadButton onDownload={onDownload} label="Save" />
			</CodeBlock>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(onDownload).toHaveBeenLastCalledWith("code.txt");

		rerender(
			<CodeBlock code="a" highlight={false}>
				<CodeBlockDownloadButton onDownload={onDownload} filename="notes.md" />
			</CodeBlock>,
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onDownload).toHaveBeenLastCalledWith("notes.md");
	});
});

describe("Labels", () => {
	const GERMAN: CodeBlockLabels = {
		copy: "Code kopieren",
		copied: "Kopiert",
		download: "Code herunterladen",
		wrap: "Umbrechen",
		noWrap: "Nicht umbrechen",
		showMore: "Mehr anzeigen",
		showLess: "Weniger anzeigen",
		code: "Quelltext",
		languageCode: (language) => `${language}-Quelltext`,
		lines: (regionLabel) => `${regionLabel}: Zeilen`,
		foldLines: (from, to) => `Zeilen ${String(from)} bis ${String(to)} einklappen`,
		unfoldLines: (from, to) => `Zeilen ${String(from)} bis ${String(to)} ausklappen`,
		unfoldHiddenLines: (count) => `${String(count)} verborgene Zeilen ausklappen`,
		hiddenLines: (count) => `... ${String(count)} Zeilen`,
		complete: (lineCount) => `Fertig, ${String(lineCount)} Zeilen.`,
	};

	it("renders every string from the root labels", (): void => {
		render(
			<CodeBlock labels={GERMAN} code={FOLDABLE} language="js" highlight={false} foldable selectable maxLines={2}>
				<CodeBlockHeader>
					<CodeBlockWrapToggle />
					<CodeBlockDownloadButton />
					<CodeBlockCopyButton />
				</CodeBlockHeader>
				<CodeBlockExpandButton />
			</CodeBlock>,
		);
		expect(screen.getByRole("region", { name: "js-Quelltext" })).toBeDefined();
		expect(screen.getByRole("listbox", { name: "js-Quelltext: Zeilen" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Umbrechen" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Code herunterladen" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Code kopieren" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Mehr anzeigen" })).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Zeilen 1 bis 4 einklappen" }));
		expect(screen.getByRole("button", { name: "3 verborgene Zeilen ausklappen" }).textContent).toBe("... 3 Zeilen");
	});

	it("lets per-part labels override the root", (): void => {
		render(
			<CodeBlock labels={GERMAN} code="a">
				<CodeBlockCopyButton labels={{ copy: "Copy me" }} />
				<CodeBlockDownloadButton label="Grab" />
				<CodeBlockWrapToggle>Custom</CodeBlockWrapToggle>
			</CodeBlock>,
		);
		expect(screen.getByRole("button", { name: "Copy me" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Grab" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Custom" })).toBeDefined();
	});

	it("falls back to the provider's labels for a copy button outside any block", (): void => {
		render(<CodeBlockCopyButton value="x" />);
		expect(screen.getByRole("button", { name: LABELS.copy }).getAttribute("data-position")).toBe("pinned");
	});

	it("speaks the provider's English copy when no labels prop is passed", (): void => {
		render(
			<CodeBlock code={FIVE_LINES} language="ts" highlight={false} maxLines={2}>
				<CodeBlockHeader>
					<CodeBlockWrapToggle />
					<CodeBlockDownloadButton />
					<CodeBlockCopyButton />
				</CodeBlockHeader>
				<CodeBlockExpandButton />
			</CodeBlock>,
		);
		expect(screen.getByRole("region", { name: LABELS.languageCode("ts") })).toBeDefined();
		expect(screen.getByRole("button", { name: LABELS.wrap })).toBeDefined();
		expect(screen.getByRole("button", { name: LABELS.download })).toBeDefined();
		expect(screen.getByRole("button", { name: LABELS.copy })).toBeDefined();
		expect(screen.getByRole("button", { name: LABELS.showMore })).toBeDefined();
	});

	it("lays a partial labels override over the provider's copy", (): void => {
		const override: Partial<CodeBlockLabels> = { copy: "Copy snippet", code: "Snippet" };
		render(
			<CodeBlock code="a" labels={override}>
				<CodeBlockWrapToggle />
				<CodeBlockCopyButton />
			</CodeBlock>,
		);
		expect(screen.getByRole("region", { name: "Snippet" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Copy snippet" })).toBeDefined();
		/* Strings the override leaves out still come from the provider. */
		expect(screen.getByRole("button", { name: LABELS.wrap })).toBeDefined();
	});

	it("throws a helpful error without a UiKitLabelsProvider", (): void => {
		vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			renderUnwrapped(<CodeBlock code="a" />);
		}).toThrow('No UiKitLabelsProvider above a component that needs "codeBlock" labels');
	});
});

describe("Composition", () => {
	it("renders the surface once, inside a composed wrapper", (): void => {
		const { container } = render(
			<CodeBlock code="a">
				<div data-testid="scroll-area">
					<CodeBlockContent className="custom" />
				</div>
			</CodeBlock>,
		);
		const surfaces = container.querySelectorAll("[data-slot=code-block-content]");
		expect(surfaces).toHaveLength(1);
		expect(screen.getByTestId("scroll-area").contains(surfaces[LIST_SLOT_INDEX.first] ?? null)).toBe(true);
		expect(viewport(container).className).toContain("custom");
		expect(viewport(container).className).not.toContain("overflow-auto");
	});

	it("reports a CodeBlockContent hidden behind a component boundary", (): void => {
		const error = vi.spyOn(console, "error").mockImplementation((): void => undefined);
		function Hidden(): React.JSX.Element {
			return <CodeBlockContent />;
		}
		const { container } = render(
			<CodeBlock code="a">
				<Hidden />
			</CodeBlock>,
		);
		expect(container.querySelectorAll("[data-slot=code-block-content]")).toHaveLength(2);
		expect(error).toHaveBeenCalledWith(expect.stringContaining("CodeBlockContent is hidden behind a component boundary"));
	});

	it("exposes the config and the current code through useCodeBlockConfig", (): void => {
		function Readout(): React.JSX.Element {
			const config = useCodeBlockConfig();
			return <span data-testid="config">{`${config.code}|${config.resolvedLanguage ?? "-"}|${String(config.wrap)}|${config.labels.copy}`}</span>;
		}
		render(
			<CodeBlock code="abc" language="yml" highlight={false} defaultWrap>
				<Readout />
			</CodeBlock>,
		);
		expect(screen.getByTestId("config").textContent).toBe(`abc|yaml|true|${LABELS.copy}`);
	});
});

describe("Markdown helpers", () => {
	it("renders a react-markdown `pre` through markdownCodeProps", (): void => {
		function MarkdownPre(props: { readonly children?: React.ReactNode }): React.JSX.Element {
			const { code, language } = markdownCodeProps(props);
			return <CodeBlock code={code} language={language} highlight={false} />;
		}
		const { container } = render(
			<MarkdownPre>
				<code className="language-ts">{"const a = 1;\nconst b = 2;\n"}</code>
			</MarkdownPre>,
		);
		expect(rows(container).map((element) => element.textContent)).toEqual(["const a = 1;", "const b = 2;"]);
		expect(screen.getByRole("region", { name: LABELS.languageCode("ts") })).toBeDefined();
	});

	it("renders each fence of a streaming transcript, the open one included", (): void => {
		const parts = markdownFences("Intro\n```py\nprint(1)\n```\nThen\n```ts\nconst a");
		const { container } = render(
			<div>
				{parts.map((part, index) =>
					part.type === "code" ? (
						<CodeBlock key={`${String(index)}-code`} code={part.content} language={part.language} streaming={part.open} highlight={false} />
					) : (
						<p key={`${String(index)}-text`}>{part.content}</p>
					),
				)}
			</div>,
		);
		const blocks = container.querySelectorAll<HTMLElement>("[data-slot=code-block]");
		expect(blocks).toHaveLength(2);
		expect(blocks[LIST_SLOT_INDEX.first]?.hasAttribute("data-streaming")).toBe(false);
		expect(blocks[LIST_SLOT_INDEX.second]?.hasAttribute("data-streaming")).toBe(true);
		expect(container.querySelectorAll("p")).toHaveLength(2);
	});
});
