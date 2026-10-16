"use client";

// The EmojiPicker examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { EmojiPicker1Example } from "@/components/component-gallery/examples/emoji-picker/emoji-picker-1";
import { EmojiPicker2Example } from "@/components/component-gallery/examples/emoji-picker/emoji-picker-2";
import { EmojiPicker3Example } from "@/components/component-gallery/examples/emoji-picker/emoji-picker-3";
import { EmojiPicker4Example } from "@/components/component-gallery/examples/emoji-picker/emoji-picker-4";
import { EmojiPicker5Example } from "@/components/component-gallery/examples/emoji-picker/emoji-picker-5";
import { EmojiPicker6Example } from "@/components/component-gallery/examples/emoji-picker/emoji-picker-6";
import { EmojiPicker7Example } from "@/components/component-gallery/examples/emoji-picker/emoji-picker-7";
import { EmojiPicker8Example } from "@/components/component-gallery/examples/emoji-picker/emoji-picker-8";

export const EMOJI_PICKER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-emoji-picker-1", label: "Inline", component: EmojiPicker1Example },
	{ id: "c-emoji-picker-2", label: "Chat Composer", component: EmojiPicker2Example },
	{ id: "c-emoji-picker-3", label: "Message Reactions", component: EmojiPicker3Example },
	{ id: "c-emoji-picker-4", label: "Page Icon", component: EmojiPicker4Example },
	{ id: "c-emoji-picker-5", label: "Custom Team Emoji", component: EmojiPicker5Example },
	{ id: "c-emoji-picker-6", label: "Shortcode Suggestions", component: EmojiPicker6Example },
	{ id: "c-emoji-picker-7", label: "Workplace-Safe Set", component: EmojiPicker7Example },
	{ id: "c-emoji-picker-8", label: "Localized Labels", component: EmojiPicker8Example },
];

export function EmojiPickerExamples(): React.JSX.Element {
	return <ExampleGrid examples={EMOJI_PICKER_EXAMPLES} />;
}
