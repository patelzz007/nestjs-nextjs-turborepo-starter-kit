// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Toaster, toastMessage } from "@workspace/ui/components/toast";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { TOAST_EXAMPLES } from "@/components/component-gallery/examples/toast";
import { Sonner10Example } from "@/components/component-gallery/examples/toast/sonner-10";
import { Sonner3Example } from "@/components/component-gallery/examples/toast/sonner-3";
import { Sonner6Example } from "@/components/component-gallery/examples/toast/sonner-6";
import { Sonner7Example } from "@/components/component-gallery/examples/toast/sonner-7";

/** The simulated deploy resolves after 2s; give the promise toast a margin on top. */
const PROMISE_SETTLE_TIMEOUT_MS = 3500;

describeGalleryExamples("Toast", TOAST_EXAMPLES);

// jsdom's `Node.contains` does not see through the toast portal the way
// browsers do; base-ui's outside-press check needs the spec behaviour.
function shimmedNodeContains(this: Node, other: Node | null): boolean {
	if (other === null) {
		return false;
	}
	return other === this || (this.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_CONTAINED_BY) !== 0;
}

/** The visible toast titles (base-ui also mirrors titles into a hidden live region, so query by slot). */
function visibleToastTitles(): readonly (string | null)[] {
	return Array.from(document.querySelectorAll("[data-slot='toast-title']")).map((node: Element): string | null => node.textContent);
}

/** An example next to the app's own `<Toaster />`, which shows the default manager's toasts. */
function renderWithToaster(example: React.JSX.Element): void {
	render(
		<>
			{example}
			<Toaster />
		</>,
		{ wrapper: UiKitTestProviders },
	);
}

describe("Toast gallery example interactions", (): void => {
	installGalleryExampleShims();

	beforeEach((): void => {
		vi.spyOn(Node.prototype, "contains").mockImplementation(shimmedNodeContains);
	});

	afterEach((): void => {
		act((): void => {
			toastMessage.dismiss();
		});
		vi.restoreAllMocks();
	});

	it("undoes the archive from the toast's action button", async (): Promise<void> => {
		renderWithToaster(<Sonner6Example />);

		fireEvent.click(screen.getByRole("button", { name: "Toast with Action" }));
		await waitFor((): void => {
			expect(visibleToastTitles()).toContain("Message archived");
		});

		const action = document.querySelector("[data-slot='toast-action']");
		expect(action?.textContent).toBe("Undo");
		if (action !== null) {
			fireEvent.click(action);
		}
		await waitFor((): void => {
			expect(visibleToastTitles()).toContain("Action undone");
		});
	});

	it("shows the toast in its own stack at the chosen corner", async (): Promise<void> => {
		render(<Sonner3Example />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: "Top Left" }));

		await waitFor((): void => {
			expect(visibleToastTitles()).toContain("Top Left");
		});
		expect(screen.getByText("Notification appears in the top left.")).toBeTruthy();
	});

	it("turns the promise toast from loading into success", async (): Promise<void> => {
		renderWithToaster(<Sonner7Example />);

		fireEvent.click(screen.getByRole("button", { name: "Deploy" }));
		// A string promise option becomes the toast's description.
		expect(await screen.findByText("Deploying to production...")).toBeTruthy();
		expect(await screen.findByText("Deployed to production successfully", undefined, { timeout: PROMISE_SETTLE_TIMEOUT_MS })).toBeTruthy();
	});

	it("renders the upload's progress bar", async (): Promise<void> => {
		renderWithToaster(<Sonner10Example />);

		fireEvent.click(screen.getByRole("button", { name: "Upload Toast" }));

		await waitFor((): void => {
			expect(visibleToastTitles()).toContain("report-q4-2025.pdf");
		});
		expect(document.querySelector("[role='progressbar']")).not.toBeNull();
	});
});
