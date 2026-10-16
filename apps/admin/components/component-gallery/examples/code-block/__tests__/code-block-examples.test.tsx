// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { CODE_BLOCK_EXAMPLES } from "@/components/component-gallery/examples/code-block";
import { CodeBlock1Example } from "@/components/component-gallery/examples/code-block/code-block-1";
import { CodeBlock12Example } from "@/components/component-gallery/examples/code-block/code-block-12";
import { CodeBlock14Example } from "@/components/component-gallery/examples/code-block/code-block-14";
import { CodeBlock22Example } from "@/components/component-gallery/examples/code-block/code-block-22";

/** Every example the folder ports from the reui registry. */
const EXAMPLE_COUNT = 27;

describeGalleryExamples("CodeBlock", CODE_BLOCK_EXAMPLES);

describe("CodeBlock gallery example interactions", (): void => {
	installGalleryExampleShims();

	let writeText: Mock<(text: string) => Promise<void>>;

	beforeEach((): void => {
		// jsdom has no async clipboard.
		writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
		Object.defineProperty(window.navigator, "clipboard", { value: { writeText }, configurable: true });
	});

	afterEach((): void => {
		Reflect.deleteProperty(window.navigator, "clipboard");
	});

	it("lists every ported example", (): void => {
		expect(CODE_BLOCK_EXAMPLES).toHaveLength(EXAMPLE_COUNT);
	});

	it("copies the block's source and flips the button to the copied state", async (): Promise<void> => {
		render(<CodeBlock1Example />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

		await waitFor((): void => {
			expect(writeText).toHaveBeenCalledTimes(1);
		});
		expect(writeText).toHaveBeenCalledWith(expect.stringContaining("export function useTotals(items: Item[])"));
		expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
	});

	it("switches the visible file when another tab is chosen", async (): Promise<void> => {
		const { container } = render(<CodeBlock14Example />, { wrapper: UiKitTestProviders });

		expect(container.textContent).toContain("return <p>Hello {name}</p>");
		fireEvent.click(screen.getByRole("tab", { name: "greeting.py" }));

		await waitFor((): void => {
			expect(screen.getByRole("tab", { name: "greeting.py" }).getAttribute("aria-selected")).toBe("true");
		});
		expect(container.textContent).toContain('return f"Hello {name}"');
	});

	it("accepting the proposed change reports it and offers an undo", (): void => {
		render(<CodeBlock22Example />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Agent proposed this change")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Accept" }));

		expect(screen.getByText("Change applied to the branch")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Undo" }));
		expect(screen.getByText("Agent proposed this change")).toBeTruthy();
	});

	it("keeps the ask button disabled until a line is selected", (): void => {
		render(<CodeBlock12Example />, { wrapper: UiKitTestProviders });

		const ask = screen.getByRole("button", { name: "Select lines to ask about them" });
		expect(ask.hasAttribute("disabled")).toBe(true);
		expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
	});
});
