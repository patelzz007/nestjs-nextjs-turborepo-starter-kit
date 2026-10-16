// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EmojiPickerData } from "@workspace/ui/lib/emoji-picker/data";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMOJI_PICKER_EXAMPLES } from "@/components/component-gallery/examples/emoji-picker";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";

// ── Emoji data, inline ──────────────────────────────────────────────────────
// The picker fetches emojibase data from a CDN by default. Tests never touch
// the network: the loader is swapped for one that resolves this small sample,
// and `fetch` itself fails loudly if anything still reaches for it.

const SAMPLE_DATA: EmojiPickerData = {
	locale: "en",
	categories: {},
	emojis: [
		{ id: "1F600", emoji: "😀", label: "grinning face", tags: ["face", "smile"], shortcodes: ["grinning"], category: "smileys", version: 1 },
		{
			id: "1F44D",
			emoji: "👍",
			label: "thumbs up",
			tags: ["yes"],
			shortcodes: ["+1", "thumbsup"],
			category: "people",
			version: 0.6,
			skins: ["👍🏻", "👍🏼", "👍🏽", "👍🏾", "👍🏿"],
		},
		{ id: "1F525", emoji: "🔥", label: "fire", tags: ["flame", "hot"], shortcodes: ["fire"], category: "travel", version: 0.6 },
		{ id: "1F3AF", emoji: "🎯", label: "bullseye", tags: ["target"], shortcodes: ["dart"], category: "activities", version: 0.6 },
	],
};

function loadSampleData(): Promise<EmojiPickerData> {
	return Promise.resolve(SAMPLE_DATA);
}

vi.mock("@workspace/ui/lib/emoji-picker/data", async (importOriginal: () => Promise<typeof import("@workspace/ui/lib/emoji-picker/data")>) => ({
	...(await importOriginal()),
	loadEmojiPickerData: loadSampleData,
}));

// ── jsdom fidelity shims ────────────────────────────────────────────────────
// jsdom has no layout engine: the picker's virtualized grid and base-ui popups
// observe sizes, and the grid scrolls the active cell into view.

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

function noopScrollIntoView(): void {
	return;
}

function rejectNetwork(): Promise<Response> {
	return Promise.reject(new Error("Network access is not allowed in tests"));
}

const fetchSpy = vi.fn(rejectNetwork);

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", NoopResizeObserver);
	vi.stubGlobal("fetch", fetchSpy);
	Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, writable: true, value: noopScrollIntoView });
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	fetchSpy.mockClear();
	Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

function exampleById(id: string): GalleryExample {
	const example = EMOJI_PICKER_EXAMPLES.find((candidate) => candidate.id === id);
	if (example === undefined) throw new Error(`Missing example ${id}`);
	return example;
}

describe("EmojiPicker gallery examples", () => {
	it.each(EMOJI_PICKER_EXAMPLES.map((example): [string, GalleryExample] => [example.label, example]))(
		"renders %s",
		(_label: string, { component: Component }: GalleryExample): void => {
			const { container } = render(<Component />, { wrapper: UiKitTestProviders });

			expect(container.firstElementChild).not.toBeNull();
			expect(container.textContent).not.toBe("");
			expect(fetchSpy).not.toHaveBeenCalled();
		},
	);

	it("suggests emoji for the draft's shortcode and inserts the accepted one", async (): Promise<void> => {
		const { component: Component } = exampleById("c-emoji-picker-6");
		render(<Component />, { wrapper: UiKitTestProviders });

		// The draft ends in `:fire`, so the sample data's fire emoji is suggested.
		const suggestion = await screen.findByRole("option", { name: /fire/i });
		fireEvent.click(suggestion);

		const field = screen.getByRole("combobox", { name: "Add a comment" });
		await waitFor((): void => {
			expect(field).toHaveProperty("value", "So much cleaner now 🔥 ");
		});
		expect(screen.queryByRole("listbox", { name: "Emoji suggestions" })).toBeNull();
	});
});
