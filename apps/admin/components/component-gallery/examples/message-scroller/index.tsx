"use client";

// The MessageScroller examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { MessageScroller1Example } from "@/components/component-gallery/examples/message-scroller/message-scroller-1";
import { MessageScroller2Example } from "@/components/component-gallery/examples/message-scroller/message-scroller-2";
import { MessageScroller3Example } from "@/components/component-gallery/examples/message-scroller/message-scroller-3";
import { MessageScroller4Example } from "@/components/component-gallery/examples/message-scroller/message-scroller-4";
import { MessageScroller5Example } from "@/components/component-gallery/examples/message-scroller/message-scroller-5";
import { MessageScroller6Example } from "@/components/component-gallery/examples/message-scroller/message-scroller-6";

export const MESSAGE_SCROLLER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-message-scroller-1", label: "Jump to Latest", component: MessageScroller1Example },
	{ id: "c-message-scroller-2", label: "Streaming Reply", component: MessageScroller2Example },
	{ id: "c-message-scroller-3", label: "Anchored Turn", component: MessageScroller3Example },
	{ id: "c-message-scroller-4", label: "Opening Position", component: MessageScroller4Example },
	{ id: "c-message-scroller-5", label: "Load Earlier", component: MessageScroller5Example },
	{ id: "c-message-scroller-6", label: "Thread Navigator", component: MessageScroller6Example },
];

export function MessageScrollerExamples(): React.JSX.Element {
	return <ExampleGrid examples={MESSAGE_SCROLLER_EXAMPLES} />;
}
