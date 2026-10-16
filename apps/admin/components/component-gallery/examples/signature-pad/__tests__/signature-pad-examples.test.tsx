// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { SIGNATURE_PAD_EXAMPLES } from "@/components/component-gallery/examples/signature-pad";
import { SignaturePad3Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-3";
import { SignaturePad6Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-6";
import { SignaturePad8Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-8";

// ── jsdom fidelity shims ────────────────────────────────────────────────────
// The pad observes its area's size; the menus and dialogs position popups.
// jsdom has neither layout API, and no 2D canvas for raster exports.

class NoopResizeObserver {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", NoopResizeObserver);
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("Signature Pad examples", () => {
	it.each(SIGNATURE_PAD_EXAMPLES.map((example: GalleryExample): [string, GalleryExample] => [example.id, example]))("renders %s", (_id: string, example: GalleryExample) => {
		const { container } = render(<example.component />, { wrapper: UiKitTestProviders });

		expect(container.textContent).not.toBe("");
	});

	it("typing a name enables adoption and announces the typed signature", () => {
		render(<SignaturePad6Example />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("tab", { name: "Type" }));
		const adopt = screen.getByRole("button", { name: "Adopt and sign" });
		expect(adopt.hasAttribute("disabled")).toBe(true);

		fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Maya Chen" } });
		fireEvent.click(adopt);

		expect(screen.getByRole("status").textContent).toBe("Typed signature adopted");
	});

	it("the dialog example opens its drawing area from the row's action", () => {
		render(<SignaturePad8Example />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("dialog")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Add signature" }));

		expect(screen.getByRole("dialog", { name: "Draw your signature" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Save signature" }).hasAttribute("disabled")).toBe(true);
	});

	it("submitting the form without a signature flags the signature field", () => {
		render(<SignaturePad3Example />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: "Submit" }));

		expect(screen.getByText("Sign above to continue.")).toBeTruthy();
		expect(screen.getByRole("status").textContent).toBe("");
	});
});
