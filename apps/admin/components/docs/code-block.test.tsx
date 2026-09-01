// @vitest-environment jsdom
//
// CodeBlock reading-feature tests (points 7–11): GitHub-style diff rendering,
// line-highlight chip, word-wrap toggle, long-block collapse, and the
// copy-with-filename toast. shiki + the toast manager are mocked so the tests
// are fast, hermetic, and don't touch the network.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CodeBlock } from "@/components/docs/code-block";

type CodeBlockProps = ComponentProps<typeof CodeBlock>;

/**
 * Renders a CodeBlock and flushes the mocked shiki promise's microtask inside
 * `act`, so the async `setHtml` never fires outside an act wrapper (silences
 * the "not wrapped in act" stderr noise; the update itself is benign).
 */
async function renderCodeBlock(props: CodeBlockProps): Promise<{ readonly container: HTMLElement }> {
	const result = render(<CodeBlock {...props} />);
	await act(async (): Promise<void> => {
		await Promise.resolve();
	});
	return result;
}

vi.mock("shiki", () => ({
	createHighlighter: vi.fn().mockResolvedValue({
		codeToHtml: (code: string): string => `<pre class="mocked-shiki"><code>${code}</code></pre>`,
	}),
}));

// The mock mirrors the toastMessage calls CodeBlock makes:
// `toastMessage.success({ title, description })` / `toastMessage.error({ title, description })`.
type ToastCall = (options: { readonly title?: string; readonly description?: string }) => void;

const toastSuccess = vi.fn<ToastCall>();
const toastError = vi.fn<ToastCall>();
vi.mock("@workspace/ui/components/feedback/toast", () => ({
	toastMessage: {
		success: (options: { readonly title?: string; readonly description?: string }): string => {
			toastSuccess(options);
			return "mock-toast-id";
		},
		error: (options: { readonly title?: string; readonly description?: string }): string => {
			toastError(options);
			return "mock-toast-id";
		},
	},
}));

afterEach(cleanup);
describe("CodeBlock diff rendering", () => {
	it("colors +, -, and @@ lines GitHub-style", async (): Promise<void> => {
		const { container } = await renderCodeBlock({ code: "+added line\n-removed line\n@@ -1,2 +1,2 @@\ncontext line", language: "diff" });

		const spans = container.querySelectorAll("pre span");
		const lines = [...spans].map((span) => ({ text: span.textContent, cls: span.className }));

		const added = lines.find((line) => line.text === "+added line");
		expect(added?.cls).toContain("bg-emerald-500/10");
		expect(added?.cls).toContain("text-emerald-300");

		const removed = lines.find((line) => line.text === "-removed line");
		expect(removed?.cls).toContain("bg-red-500/10");
		expect(removed?.cls).toContain("text-red-300");

		const hunk = lines.find((line) => line.text.startsWith("@@"));
		expect(hunk?.cls).toContain("bg-sky-500/10");
		expect(hunk?.cls).toContain("text-sky-300");

		expect(container.textContent).toContain("context line");
	});

	it("keeps the language label in the header", async (): Promise<void> => {
		await renderCodeBlock({ code: "+a\n-b", language: "diff" });
		expect(screen.getByText("diff")).toBeTruthy();
	});
});
describe("CodeBlock line highlights", () => {
	// The chip only renders once the shiki tint exists (`html !== null`), so
	// these use a shiki-mapped language — the mocked highlighter resolves and
	// the chip appears.
	it("shows an N-lines-highlighted chip when highlightLines is provided", async (): Promise<void> => {
		await renderCodeBlock({ code: "line 1\nline 2\nline 3", language: "typescript", highlightLines: [1, 3] });
		expect(screen.getByText("2 lines highlighted")).toBeTruthy();
	});

	it("shows a singular chip for one line", async (): Promise<void> => {
		await renderCodeBlock({ code: "line 1\nline 2", language: "typescript", highlightLines: [2] });
		expect(screen.getByText("1 line highlighted")).toBeTruthy();
	});

	it("ignores out-of-range and non-integer lines without a chip", async (): Promise<void> => {
		await renderCodeBlock({ code: "line 1", language: "typescript", highlightLines: [0, 99, 1.5] });
		expect(screen.queryByText(/highlighted/)).toBeNull();
	});
});
describe("CodeBlock word-wrap toggle", () => {
	it("toggles aria-pressed and wraps the plain pre body", async (): Promise<void> => {
		const { container } = await renderCodeBlock({ code: "a".repeat(200), language: "plaintext" });
		const toggle = screen.getByRole("button", { name: "Toggle word wrap" });

		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		const pre = container.querySelector("pre");
		expect(pre?.className).not.toContain("whitespace-pre-wrap");

		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		expect(container.querySelector("pre")?.className).toContain("whitespace-pre-wrap");

		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
	});
});
describe("CodeBlock long-block collapse", () => {
	const LONG_CODE = Array.from({ length: 40 }, (_, index) => `line ${String(index + 1)}`).join("\n");

	it("collapses blocks over 30 lines behind a Show-all button", async (): Promise<void> => {
		const { container } = await renderCodeBlock({ code: LONG_CODE, language: "plaintext" });

		const button = screen.getByRole("button", { name: "Show all 40 lines" });
		expect(button).toBeTruthy();
		// The body wrapper is height-clamped while collapsed.
		expect(container.querySelector(".relative")?.className).toContain("max-h-[48rem]");

		fireEvent.click(button);
		expect(screen.getByRole("button", { name: "Show less" })).toBeTruthy();
	});

	it("does NOT collapse blocks at or under 30 lines", async (): Promise<void> => {
		const code = Array.from({ length: 30 }, (_, index) => `line ${String(index + 1)}`).join("\n");
		await renderCodeBlock({ code, language: "plaintext" });
		expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
	});
});

describe("CodeBlock copy toast", () => {
	beforeEach((): void => {
		toastSuccess.mockClear();
		toastError.mockClear();
		Object.defineProperty(globalThis.navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn().mockResolvedValue(undefined) },
		});
	});

	it("toasts with the file name on successful copy", async (): Promise<void> => {
		await renderCodeBlock({ code: "const x = 1;", language: "typescript", fileName: "demo.ts" });

		fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

		await waitFor((): void => {
			expect(toastSuccess).toHaveBeenCalledWith({ title: "Copied demo.ts", description: "The code is on your clipboard." });
		});
	});

	it("falls back to the language label when there is no file name", async (): Promise<void> => {
		await renderCodeBlock({ code: "const x = 1;", language: "bash" });

		fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

		await waitFor((): void => {
			expect(toastSuccess).toHaveBeenCalledWith({ title: "Copied bash", description: "The code is on your clipboard." });
		});
	});

	it("toasts an error when clipboard access is blocked", async (): Promise<void> => {
		Object.defineProperty(globalThis.navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
		});
		await renderCodeBlock({ code: "x", language: "plaintext" });

		fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

		await waitFor((): void => {
			expect(toastError).toHaveBeenCalledWith({ title: "Could not copy code", description: "Your browser blocked clipboard access." });
		});
	});
});
