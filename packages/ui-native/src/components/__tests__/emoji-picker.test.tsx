import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { emojiPickerDataFromEmojibase } from "../../lib/emoji-picker";
import { SHEET_MOTION } from "../../lib/motion";
import { EmojiPicker, EmojiPickerPanel, emojiPickerSectionsOf, DEFAULT_EMOJI_PICKER_LABELS } from "../emoji-picker";

const DATA = emojiPickerDataFromEmojibase({
	compact: [
		{ group: 0, hexcode: "1F600", label: "grinning face", order: 1, tags: ["grin"], unicode: "😀" },
		{
			group: 1,
			hexcode: "1F44B",
			label: "waving hand",
			order: 2,
			tags: ["wave"],
			unicode: "👋",
			skins: ["1F3FB", "1F3FC", "1F3FD", "1F3FE", "1F3FF"].map((tone: string, index: number) => ({ hexcode: `1F44B-${tone}`, unicode: `👋${String(index + 1)}` })),
		},
		{ group: 9, hexcode: "1F3C1", label: "chequered flag", order: 3, tags: ["race"], unicode: "🏁" },
	],
});
const CUSTOM = [{ id: "shipit", label: "ship it", src: "https://example.com/shipit.png", category: "team" }];
const TEAM = [{ id: "team", label: "Team" }];

describe("emojiPickerSectionsOf", () => {
	it("orders frequently used, custom and Unicode sections, leaving out empty and excluded ones", () => {
		const base = { data: DATA, customEmoji: CUSTOM, customCategories: TEAM, excludeCategories: [], labels: DEFAULT_EMOJI_PICKER_LABELS };
		expect(emojiPickerSectionsOf({ ...base, frequent: ["👋"], customPosition: "end" }).map((section) => section.id)).toStrictEqual([
			"frequent",
			"team",
			"smileys",
			"people",
			"flags",
		]);
		expect(emojiPickerSectionsOf({ ...base, frequent: [], customPosition: "start", excludeCategories: ["flags"] }).map((section) => section.id)).toStrictEqual([
			"team",
			"smileys",
			"people",
		]);
	});
});

describe("EmojiPickerPanel", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("shows a spinner while the data loads", async () => {
		await render(<EmojiPickerPanel data={null} onSelect={jest.fn()} />);
		expect(screen.getByLabelText("Loading emoji")).toBeOnTheScreen();
	});

	it("picks an emoji in the chosen skin tone, and searches", async () => {
		const onSelect = jest.fn();
		const onSkinToneChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(<EmojiPickerPanel ref={ref} data={DATA} onSelect={onSelect} onSkinToneChange={onSkinToneChange} value="😀" variant="card" />);
		expect(screen.getByRole("tab", { name: "Smileys & Emotion" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "grinning face" })).toBeSelected();

		await fireEvent.press(screen.getByRole("button", { name: "Skin tone: Default" }));
		await fireEvent.press(screen.getByRole("radio", { name: "Medium" }));
		expect(onSkinToneChange).toHaveBeenCalledWith(3);
		await fireEvent.press(screen.getByRole("button", { name: "waving hand" }));
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: "👋3", skinTone: 3 }));

		await fireEvent.changeText(screen.getByLabelText("Search emoji"), "race");
		expect(screen.getByRole("header", { name: "Search results" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "chequered flag" })).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByLabelText("Search emoji"), "zzz");
		expect(screen.getByText("No emoji found.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Clear search" }));
		expect(screen.getByRole("tab", { name: "Flags" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("tab", { name: "Flags" }));
		expect(screen.getByRole("tab", { name: "Flags" })).toBeSelected();
		expect(ref.current).not.toBeNull();
	});

	it("takes labels in another language and lists custom emoji as images", async () => {
		await render(
			<EmojiPickerPanel
				data={DATA}
				onSelect={jest.fn()}
				customEmoji={CUSTOM}
				customCategories={TEAM}
				hideSkinTones
				labels={{ searchPlaceholder: "Emoji suchen", search: "Emoji suchen" }}
			/>,
		);
		expect(screen.getByLabelText("Emoji suchen")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "ship it" })).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: /Skin tone/u })).toBeNull();
	});
});

describe("EmojiPicker", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("opens the panel in a sheet from its button, reports the pick and closes", async () => {
		const onSelect = jest.fn();
		await render(<EmojiPicker label="Reaction" data={DATA} value={null} onSelect={onSelect} />);
		await fireEvent.press(screen.getByRole("button", { name: "Reaction" }));
		await fireEvent.press(screen.getByRole("button", { name: "grinning face" }));
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: "😀" }));
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
		});
		expect(screen.queryByRole("button", { name: "grinning face" })).toBeNull();
	});

	it("shows the picked emoji, named, on its button", async () => {
		await render(<EmojiPicker label="Page icon" data={DATA} value="🏁" onSelect={jest.fn()} triggerSize="lg" />);
		expect(screen.getByRole("button", { name: "Page icon: chequered flag" })).toHaveTextContent("🏁");
	});
});
