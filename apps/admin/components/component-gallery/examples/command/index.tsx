"use client";

// The Command examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Command1Example } from "@/components/component-gallery/examples/command/command-1";
import { Command2Example } from "@/components/component-gallery/examples/command/command-2";
import { Command3Example } from "@/components/component-gallery/examples/command/command-3";
import { Command4Example } from "@/components/component-gallery/examples/command/command-4";
import { Command5Example } from "@/components/component-gallery/examples/command/command-5";
import { Command6Example } from "@/components/component-gallery/examples/command/command-6";
import { Command7Example } from "@/components/component-gallery/examples/command/command-7";
import { Command8Example } from "@/components/component-gallery/examples/command/command-8";

export const COMMAND_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-command-1", label: "Basic", component: Command1Example },
	{ id: "c-command-2", label: "Shortcuts", component: Command2Example },
	{ id: "c-command-3", label: "Groups", component: Command3Example },
	{ id: "c-command-4", label: "Many Groups", component: Command4Example },
	{ id: "c-command-5", label: "File Search", component: Command5Example },
	{ id: "c-command-6", label: "User Search", component: Command6Example },
	{ id: "c-command-7", label: "Action Palette", component: Command7Example },
	{ id: "c-command-8", label: "Recent & Favorites", component: Command8Example },
];

export function CommandExamples(): React.JSX.Element {
	return <ExampleGrid examples={COMMAND_EXAMPLES} />;
}
