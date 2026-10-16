// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { stubResizeObserverForCalendarDropdowns } from "@workspace/ui/testing/calendar-dropdowns";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	EmojiPicker,
	EmojiPickerList,
	EmojiPickerPanel,
	EmojiPickerSearch,
	EmojiPickerTrigger,
	EmojiPickerValue,
	useEmojiPicker,
	type EmojiPickerData,
	type EmojiPickerI18nOverrides,
} from "../emoji-picker";
import { resetEmojiPickerDataCache } from "@workspace/ui/lib/emoji-picker/data";

const DATA: EmojiPickerData = {
	locale: "en",
	categories: {},
	emojis: [
		{ id: "1F600", emoji: "😀", label: "grinning face", tags: ["face", "smile"], shortcodes: ["grinning"], category: "smileys", version: 1 },
		{ id: "1F602", emoji: "😂", label: "face with tears of joy", tags: ["laugh"], shortcodes: ["joy"], category: "smileys", version: 0.6 },
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
		{ id: "1F431", emoji: "🐱", label: "cat face", tags: ["pet"], shortcodes: ["cat"], category: "nature", version: 0.6 },
	],
};

/** Stable picker settings: in-memory recents and tone, no device probe. */
const BASE = { data: DATA, emojiVersion: 16, recentStorageKey: null, skinToneStorageKey: null };

const GERMAN_TRIGGER: EmojiPickerI18nOverrides = { labels: { trigger: "Emoji hinzufügen" } };

beforeEach((): void => {
	stubResizeObserverForCalendarDropdowns();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	resetEmojiPickerDataCache();
});

function option(name: string): HTMLElement {
	return screen.getByRole("option", { name });
}

/** A self-hosted emojibase-data copy: fetched, so its failure path can be exercised (the default is bundled data). */
const SELF_HOSTED_DATA_URL = "https://cdn.test/emoji";

describe("EmojiPicker", () => {
	it("renders a named trigger and forwards its ref to it, merging className", (): void => {
		const ref = React.createRef<HTMLButtonElement>();
		render(<EmojiPicker {...BASE} ref={ref} id="reaction" className="custom-trigger" />, { wrapper: UiKitTestProviders });
		const trigger = screen.getByRole("button", { name: "Add emoji" });
		expect(ref.current).toBe(trigger);
		expect(trigger.id).toBe("reaction");
		expect(trigger.className).toContain("custom-trigger");
		expect(trigger.dataset.slot).toBe("emoji-picker-trigger");
	});

	it("opens a popover with the search, category tabs and the grid", (): void => {
		render(<EmojiPicker {...BASE} defaultOpen />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("dialog", { name: "Emoji picker" })).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "Search emoji" })).toBeTruthy();
		expect(screen.getByRole("listbox", { name: "Emoji" })).toBeTruthy();
		expect(screen.getByRole("tablist", { name: "Emoji categories" })).toBeTruthy();
		expect(screen.getByRole("tab", { name: "Smileys & emotion" })).toBeTruthy();
		expect(option("Grinning face")).toBeTruthy();
	});

	it("reports a pick through onValueChange and onEmojiSelect, records it as recent, and closes", (): void => {
		const onValueChange = vi.fn();
		const onEmojiSelect = vi.fn();
		const onOpenChange = vi.fn();
		const onRecentChange = vi.fn();
		render(<EmojiPicker {...BASE} defaultOpen onValueChange={onValueChange} onEmojiSelect={onEmojiSelect} onOpenChange={onOpenChange} onRecentChange={onRecentChange} />, {
			wrapper: UiKitTestProviders,
		});
		fireEvent.click(option("Cat face"));
		expect(onValueChange).toHaveBeenCalledWith("🐱");
		expect(onEmojiSelect).toHaveBeenCalledWith(expect.objectContaining({ value: "🐱", skinTone: 0 }));
		expect(onRecentChange).toHaveBeenCalledWith([{ id: "1F431", count: 1 }]);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("shows a controlled value on the trigger and applies the skin tone to a pick", (): void => {
		const onValueChange = vi.fn();
		render(<EmojiPicker {...BASE} value="👍🏽" skinTone={2} open onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: "Add emoji: Thumbs up" }).textContent).toContain("👍🏽");
		expect(option("Thumbs up").getAttribute("aria-selected")).toBe("true");
		fireEvent.click(option("Grinning face"));
		expect(onValueChange).toHaveBeenCalledWith("😀");
		fireEvent.click(option("Thumbs up"));
		expect(onValueChange).toHaveBeenLastCalledWith("👍🏼");
	});

	it("filters with the search, announces the count, and picks the best match on Enter", (): void => {
		const onValueChange = vi.fn();
		render(<EmojiPicker {...BASE} defaultOpen onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });
		const search = screen.getByRole("combobox", { name: "Search emoji" });
		fireEvent.change(search, { target: { value: "joy" } });
		expect(screen.getAllByRole("option")).toHaveLength(1);
		expect(screen.getByText("1 emoji found")).toBeTruthy();
		expect(search.getAttribute("aria-activedescendant")).not.toBeNull();
		fireEvent.keyDown(search, { key: "Enter" });
		expect(onValueChange).toHaveBeenCalledWith("😂");
	});

	it("shows the empty state when nothing matches", (): void => {
		render(<EmojiPicker {...BASE} defaultOpen />, { wrapper: UiKitTestProviders });
		fireEvent.change(screen.getByRole("combobox", { name: "Search emoji" }), { target: { value: "zebra" } });
		expect(screen.getByText("No emoji found")).toBeTruthy();
		expect(screen.queryAllByRole("option")).toHaveLength(0);
	});

	it("moves the highlight with the arrow keys from the search", (): void => {
		render(<EmojiPicker {...BASE} defaultOpen />, { wrapper: UiKitTestProviders });
		const search = screen.getByRole("combobox", { name: "Search emoji" });
		fireEvent.keyDown(search, { key: "ArrowDown" });
		const first = search.getAttribute("aria-activedescendant");
		expect(first).not.toBeNull();
		fireEvent.keyDown(search, { key: "ArrowRight" });
		expect(search.getAttribute("aria-activedescendant")).not.toBe(first);
	});

	it("toggles values in multiple mode, stays open, and refuses picks at max", (): void => {
		const onValueChange = vi.fn();
		const onOpenChange = vi.fn();
		render(<EmojiPicker {...BASE} multiple max={1} defaultOpen onValueChange={onValueChange} onOpenChange={onOpenChange} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("listbox").getAttribute("aria-multiselectable")).toBe("true");
		fireEvent.click(option("Cat face"));
		expect(onValueChange).toHaveBeenLastCalledWith(["🐱"]);
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(option("Grinning face").getAttribute("aria-disabled")).toBe("true");
		fireEvent.click(option("Grinning face"));
		expect(onValueChange).toHaveBeenCalledTimes(1);
		fireEvent.click(option("Cat face"));
		expect(onValueChange).toHaveBeenLastCalledWith([]);
	});

	it("renders an inline panel as a named group with the disabled state", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<EmojiPicker {...BASE} disabled>
				<EmojiPickerPanel ref={ref} className="custom-panel" />
			</EmojiPicker>,
			{ wrapper: UiKitTestProviders },
		);
		const panel = screen.getByRole("group", { name: "Emoji picker" });
		expect(ref.current).toBe(panel);
		expect(panel.className).toContain("custom-panel");
		expect(panel.className).toContain("opacity-50");
		expect(panel.dataset.state).toBe("disabled");
		expect(screen.getByRole("combobox", { name: "Search emoji" }).hasAttribute("disabled")).toBe(true);
	});

	it("disables the trigger and marks it invalid", (): void => {
		render(<EmojiPicker {...BASE} disabled invalid />, { wrapper: UiKitTestProviders });
		const trigger = screen.getByRole("button", { name: "Add emoji" });
		expect(trigger.hasAttribute("disabled")).toBe(true);
		expect(trigger.getAttribute("aria-invalid")).toBe("true");
	});

	it("lays per-usage i18n over the UI kit labels", (): void => {
		render(<EmojiPicker {...BASE} i18n={GERMAN_TRIGGER} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: "Emoji hinzufügen" })).toBeTruthy();
	});

	it("submits the value through a hidden form field and forwards the input ref", (): void => {
		const inputRef = React.createRef<HTMLInputElement>();
		render(<EmojiPicker {...BASE} name="reaction" defaultValue="😀" inputRef={inputRef} />, { wrapper: UiKitTestProviders });
		expect(inputRef.current?.name).toBe("reaction");
		expect(inputRef.current?.value).toBe("😀");
	});

	it("passes focus and blur to the default trigger", (): void => {
		const onFocus = vi.fn();
		const onBlur = vi.fn();
		render(<EmojiPicker {...BASE} onFocus={onFocus} onBlur={onBlur} />, { wrapper: UiKitTestProviders });
		const trigger = screen.getByRole("button", { name: "Add emoji" });
		fireEvent.focus(trigger);
		fireEvent.blur(trigger);
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it("shows a loading skeleton while self-hosted data loads, then an error with a retry", async (): Promise<void> => {
		const fetchMock = vi.fn((): Promise<Response> => Promise.resolve(new Response("{}", { status: 500 })));
		vi.stubGlobal("fetch", fetchMock);
		render(
			<EmojiPicker dataUrl={SELF_HOSTED_DATA_URL} emojiVersion={16} shortcodes={false} recentStorageKey={null} skinToneStorageKey={null}>
				<EmojiPickerPanel />
			</EmojiPicker>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("status", { name: "Loading emoji" })).toBeTruthy();
		expect(screen.getByRole("listbox").getAttribute("aria-busy")).toBe("true");
		const retry = await screen.findByRole("button", { name: "Try again" });
		expect(screen.getByText("Couldn't load emoji")).toBeTruthy();
		fetchMock.mockImplementation((): Promise<Response> => Promise.resolve(new Response(JSON.stringify([]), { status: 200 })));
		act((): void => {
			fireEvent.click(retry);
		});
		expect(await screen.findByText("No emoji found")).toBeTruthy();
	});
});

function ValueReadout(): React.JSX.Element {
	const api = useEmojiPicker();
	return <output>{`${api.value ?? "none"}|${String(api.emojis.length)}|${api.status}`}</output>;
}

describe("EmojiPicker parts", () => {
	it("composes custom parts and exposes state through useEmojiPicker", (): void => {
		const searchRef = React.createRef<HTMLInputElement>();
		const listRef = React.createRef<HTMLDivElement>();
		const valueRef = React.createRef<HTMLSpanElement>();
		render(
			<EmojiPicker {...BASE} defaultValue="🐱">
				<EmojiPickerTrigger className="composed-trigger">
					<EmojiPickerValue ref={valueRef} placeholder="?" />
				</EmojiPickerTrigger>
				<EmojiPickerPanel>
					<EmojiPickerSearch ref={searchRef} placeholder="Find" />
					<EmojiPickerList ref={listRef} />
				</EmojiPickerPanel>
				<ValueReadout />
			</EmojiPicker>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("button", { name: "Add emoji: Cat face" }).className).toContain("composed-trigger");
		expect(valueRef.current?.textContent).toBe("🐱");
		expect(searchRef.current?.placeholder).toBe("Find");
		expect(listRef.current?.getAttribute("role")).toBe("listbox");
		expect(document.querySelector("output")?.textContent).toBe("🐱|4|ready");
	});
});
