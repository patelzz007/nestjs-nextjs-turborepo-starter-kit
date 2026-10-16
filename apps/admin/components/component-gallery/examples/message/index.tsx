"use client";

// The Message examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Message1Example } from "@/components/component-gallery/examples/message/message-1";
import { Message2Example } from "@/components/component-gallery/examples/message/message-2";
import { Message3Example } from "@/components/component-gallery/examples/message/message-3";
import { Message4Example } from "@/components/component-gallery/examples/message/message-4";
import { Message5Example } from "@/components/component-gallery/examples/message/message-5";
import { Message6Example } from "@/components/component-gallery/examples/message/message-6";
import { Message7Example } from "@/components/component-gallery/examples/message/message-7";

export const MESSAGE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-message-1", label: "Two-Sided Chat", component: Message1Example },
	{ id: "c-message-2", label: "Avatars", component: Message2Example },
	{ id: "c-message-3", label: "Sender & Status", component: Message3Example },
	{ id: "c-message-4", label: "Reply Actions", component: Message4Example },
	{ id: "c-message-5", label: "Shared Files", component: Message5Example },
	{ id: "c-message-6", label: "Consecutive Messages", component: Message6Example },
	{ id: "c-message-7", label: "Streaming Reply", component: Message7Example },
];

export function MessageExamples(): React.JSX.Element {
	return <ExampleGrid examples={MESSAGE_EXAMPLES} />;
}
