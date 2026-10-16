// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionsFamily } from "@/components/component-gallery/actions-family";
import { DataDisplayFamily } from "@/components/component-gallery/data-display-family";
import { DisclosureNavigationFamily } from "@/components/component-gallery/disclosure-navigation-family";
import { FeedbackStatusFamily } from "@/components/component-gallery/feedback-status-family";
import { FormInputsFamily } from "@/components/component-gallery/form-inputs-family";
import { EXAMPLE_ONLY_KEYS, GALLERY_ENTRIES, GALLERY_FAMILIES, type GalleryComponentKey, type GalleryFamilyId } from "@/components/component-gallery/gallery-catalog";
import { MediaContentFamily } from "@/components/component-gallery/media-content-family";
import { OverlaysFamily } from "@/components/component-gallery/overlays-family";
import { SelectionFamily } from "@/components/component-gallery/selection-family";

// ── jsdom fidelity shims ────────────────────────────────────────────────────
// jsdom has no layout engine. The carousels (embla) and base-ui popups observe
// element sizes, the gallery's `LazySection`s and the image components observe
// visibility, and cmdk scrolls the active command into view. Give them the
// browser APIs they expect: sizes never change, and every observed element is
// reported on screen at once — so each section mounts its demos immediately.

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

type VisibleEntry = Pick<IntersectionObserverEntry, "isIntersecting" | "intersectionRatio" | "target" | "boundingClientRect" | "intersectionRect" | "rootBounds" | "time">;
type VisibleCallback = (entries: readonly VisibleEntry[]) => void;

/** Reports every observed element as fully on screen, as soon as it is observed. */
class OnScreenIntersectionObserver {
	public constructor(private readonly _callback: VisibleCallback) {}

	public observe(target: Element): void {
		const bounds = target.getBoundingClientRect();
		this._callback([{ isIntersecting: true, intersectionRatio: 1, target, boundingClientRect: bounds, intersectionRect: bounds, rootBounds: null, time: 0 }]);
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
	public takeRecords(): readonly VisibleEntry[] {
		return [];
	}
}

function noopScrollIntoView(): void {
	return;
}

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", NoopResizeObserver);
	vi.stubGlobal("IntersectionObserver", OnScreenIntersectionObserver);
	Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, writable: true, value: noopScrollIntoView });
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

const FAMILY_VIEWS: Readonly<Record<GalleryFamilyId, () => React.JSX.Element>> = {
	"family-actions": ActionsFamily,
	"family-form-inputs": FormInputsFamily,
	"family-selection": SelectionFamily,
	"family-overlays": OverlaysFamily,
	"family-disclosure-navigation": DisclosureNavigationFamily,
	"family-feedback-status": FeedbackStatusFamily,
	"family-data-display": DataDisplayFamily,
	"family-media-content": MediaContentFamily,
};

function renderFamily(familyId: GalleryFamilyId): ReturnType<typeof render> {
	const View = FAMILY_VIEWS[familyId];
	return render(<View />, { wrapper: UiKitTestProviders });
}

/** The section of one component, as rendered. */
function sectionOf(key: GalleryComponentKey): HTMLElement {
	const section = document.getElementById(GALLERY_ENTRIES[key].id);
	if (section === null) {
		throw new Error(`No section for ${key}`);
	}
	return section;
}

describe("every family mounts the live demos of all its components", () => {
	it.each(GALLERY_FAMILIES)("$title", ({ id, keys }) => {
		const { container } = renderFamily(id);
		for (const key of keys) {
			const section = sectionOf(key);
			// The placeholder bones are gone: the section's demos are mounted.
			expect(section.querySelector('[data-skeleton="section"]'), key).toBeNull();
			if (EXAMPLE_ONLY_KEYS.has(key)) {
				// Shown through its worked examples (examples/): a heading, then the examples block.
				expect(within(section).getByRole("heading", { level: 2, name: "Examples" }), key).toBeTruthy();
			} else {
				expect(within(section).getByRole("heading", { level: 2, name: "Live demo" }), key).toBeTruthy();
			}
		}
		expect(container.querySelectorAll("[data-gallery-section]")).toHaveLength(keys.length);
	});
});

describe("Actions demos", () => {
	it("toggles the bold Toggle and echoes the page state", () => {
		renderFamily("family-actions");
		const toggle = within(sectionOf("toggle")).getByRole("button", { name: "Bold" });
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		expect(within(sectionOf("toggle")).getByText("on")).toBeTruthy();
	});

	it("keeps exactly one alignment pressed in the single-choice ToggleGroup", () => {
		renderFamily("family-actions");
		const group = sectionOf("toggleGroup");
		fireEvent.click(within(group).getByRole("button", { name: "Align right" }));
		expect(within(group).getByRole("button", { name: "Align right" }).getAttribute("aria-pressed")).toBe("true");
		expect(within(group).getByRole("button", { name: "Align left" }).getAttribute("aria-pressed")).toBe("false");
		expect(within(group).getByText("right")).toBeTruthy();
	});

	it("shows the Button loading state while the demo save runs, then restores it", () => {
		vi.useFakeTimers();
		try {
			renderFamily("family-actions");
			const button = within(sectionOf("button")).getByRole("button", { name: "Save (shows loading)" });
			fireEvent.click(button);
			const saving = within(sectionOf("button")).getByRole("button", { name: "Saving…" });
			expect(saving.hasAttribute("data-loading")).toBe(true);
			act(() => {
				vi.runAllTimers();
			});
			expect(within(sectionOf("button")).getByRole("button", { name: "Save (shows loading)" }).hasAttribute("data-loading")).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("Form input demos", () => {
	it("shows the Field error while the email is invalid and clears it once valid", () => {
		renderFamily("family-form-inputs");
		const field = sectionOf("field");
		const email = within(field).getByLabelText("Email");
		expect(email.getAttribute("aria-invalid")).toBe("true");
		expect(within(field).getByRole("alert").textContent).toContain("Enter a valid email address");

		fireEvent.change(email, { target: { value: "ada@example.com" } });
		expect(email.getAttribute("aria-invalid")).toBe("false");
		expect(within(field).queryByRole("alert")).toBeNull();
	});

	it("scores the typed password in the PasswordStrengthMeter", () => {
		renderFamily("family-form-inputs");
		const meter = sectionOf("passwordStrengthMeter");
		fireEvent.change(within(meter).getByLabelText("Try a password"), { target: { value: "Str0ng!Passw0rd" } });
		expect(within(meter).getByText("Strong")).toBeTruthy();
		fireEvent.change(within(meter).getByLabelText("Try a password"), { target: { value: "abc" } });
		expect(within(meter).getByText("Weak")).toBeTruthy();
	});
});

describe("Selection demos", () => {
	it("toggles the controlled Switch", () => {
		renderFamily("family-selection");
		const section = sectionOf("switch");
		const control = within(section).getByRole("switch", { name: "Maintenance mode" });
		expect(control.getAttribute("aria-checked")).toBe("false");
		fireEvent.click(control);
		expect(control.getAttribute("aria-checked")).toBe("true");
		expect(within(section).getByText("on")).toBeTruthy();
	});

	it("marks the select-all Checkbox mixed until every channel is checked", () => {
		renderFamily("family-selection");
		const section = sectionOf("checkbox");
		const all = within(section).getByRole("checkbox", { name: "All channels" });
		expect(all.getAttribute("aria-checked")).toBe("mixed");

		fireEvent.click(within(section).getByRole("checkbox", { name: "SMS" }));
		fireEvent.click(within(section).getByRole("checkbox", { name: "Push notifications" }));
		expect(all.getAttribute("aria-checked")).toBe("true");

		fireEvent.click(all);
		expect(all.getAttribute("aria-checked")).toBe("false");
		expect(within(section).getByRole("checkbox", { name: "Email" }).getAttribute("aria-checked")).toBe("false");
	});
});

describe("Overlay demos", () => {
	it("opens the Dialog, saves the edited name and closes", async () => {
		renderFamily("family-overlays");
		const section = sectionOf("dialog");
		fireEvent.click(within(section).getByRole("button", { name: "Rename store" }));

		const dialog = await screen.findByRole("dialog", { name: "Rename store" });
		expect(within(section).getByText("open")).toBeTruthy();
		fireEvent.change(within(dialog).getByLabelText("Store name"), { target: { value: "Acme Tea" } });
		fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(screen.queryByRole("dialog", { name: "Rename store" })).toBeNull();
		});
		expect(within(section).getByText("closed")).toBeTruthy();
		expect(within(section).getByText("Acme Tea")).toBeTruthy();
	});

	it("runs a Command when it is chosen", () => {
		renderFamily("family-overlays");
		const section = sectionOf("command");
		fireEvent.click(within(section).getByRole("option", { name: "Calendar" }));
		expect(within(section).getByText("Calendar", { selector: "span" })).toBeTruthy();
	});
});

describe("Disclosure & navigation demos", () => {
	it("moves between pages with the Pagination links, without navigating", () => {
		renderFamily("family-disclosure-navigation");
		const section = sectionOf("pagination");
		fireEvent.click(within(section).getByRole("link", { name: "Go to the next page" }));
		expect(within(section).getByRole("link", { name: "2" }).getAttribute("aria-current")).toBe("page");
		fireEvent.click(within(section).getByRole("link", { name: "12" }));
		expect(within(section).getByText("12 of 12")).toBeTruthy();
	});

	it("advances the Stepper with its buttons", () => {
		renderFamily("family-disclosure-navigation");
		const section = sectionOf("stepper");
		expect(within(section).getByRole("tabpanel").textContent).toContain("Business");
		fireEvent.click(within(section).getByRole("button", { name: "Next" }));
		expect(within(section).getByRole("tabpanel").textContent).toContain("Verification");
		fireEvent.click(within(section).getByRole("button", { name: "Back" }));
		fireEvent.click(within(section).getByRole("button", { name: "Back" }));
		expect(within(section).getByRole("tabpanel").textContent).toContain("Account");
		expect(within(section).getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(true);
	});
});

describe("Feedback & status demos", () => {
	it("swaps the Skeleton for the content once loaded", () => {
		renderFamily("family-feedback-status");
		const section = sectionOf("skeleton");
		expect(within(section).queryByText("Ada Lovelace")).toBeNull();
		fireEvent.click(within(section).getByRole("switch", { name: "Content loaded" }));
		expect(within(section).getByText("Ada Lovelace")).toBeTruthy();
	});

	it("moves the Progress bar with its buttons", () => {
		renderFamily("family-feedback-status");
		const section = sectionOf("progress");
		const [bar] = within(section).getAllByRole("progressbar");
		expect(bar?.getAttribute("aria-valuenow")).toBe("40");
		fireEvent.click(within(section).getByRole("button", { name: "Increase the progress" }));
		expect(bar?.getAttribute("aria-valuenow")).toBe("50");
	});
});

describe("Media & content demos", () => {
	it("removes an Attachment and restores the list", () => {
		renderFamily("family-media-content");
		const section = sectionOf("attachment");
		fireEvent.click(within(section).getByRole("button", { name: "Remove notes.txt" }));
		expect(within(section).queryByText("notes.txt")).toBeNull();
		fireEvent.click(within(section).getByRole("button", { name: "Restore removed files" }));
		expect(within(section).getByText("notes.txt")).toBeTruthy();
	});

	it("sends a Message reply", () => {
		renderFamily("family-media-content");
		const section = sectionOf("message");
		fireEvent.change(within(section).getByLabelText("Reply"), { target: { value: "Approved!" } });
		fireEvent.click(within(section).getByRole("button", { name: "Send" }));
		expect(within(section).getByText("Approved!")).toBeTruthy();
		const reply = within(section).getByLabelText("Reply");
		expect(reply instanceof HTMLInputElement ? reply.value : null).toBe("");
	});

	it("resizes the ImageResizer photo from the keyboard, keeping its shape until the switch frees it", () => {
		renderFamily("family-media-content");
		const section = sectionOf("imageResizer");
		const corner = within(section).getByRole("button", { name: "Resize from the bottom-right corner" });

		// A keyboard step is committed at once: the live and the saved size both move.
		fireEvent.keyDown(corner, { key: "ArrowRight" });
		expect(within(section).getAllByText("394 × 222 px")).toHaveLength(2);

		fireEvent.click(within(section).getByRole("switch", { name: "Keep the aspect ratio" }));
		fireEvent.keyDown(within(section).getByRole("button", { name: "Resize from the bottom edge" }), { key: "ArrowDown" });
		expect(within(section).getAllByText("394 × 232 px")).toHaveLength(2);
	});

	it("opens the in-memory sample statement in the PdfViewer, with a file picker", async () => {
		URL.createObjectURL = vi.fn((): string => "blob:http://localhost/sample");
		URL.revokeObjectURL = vi.fn((): void => undefined);
		renderFamily("family-media-content");
		const section = sectionOf("pdfViewer");
		await waitFor(() => {
			expect(within(section).getByTitle("PDF: sample-statement.pdf").getAttribute("src")).toBe("blob:http://localhost/sample");
		});
		expect(within(section).getAllByRole("button", { name: "Open a PDF" }).length).toBeGreaterThan(0);
	});
});
