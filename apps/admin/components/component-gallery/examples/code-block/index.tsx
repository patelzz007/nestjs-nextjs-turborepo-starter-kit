"use client";

// The CodeBlock examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { CodeBlock1Example } from "@/components/component-gallery/examples/code-block/code-block-1";
import { CodeBlock2Example } from "@/components/component-gallery/examples/code-block/code-block-2";
import { CodeBlock3Example } from "@/components/component-gallery/examples/code-block/code-block-3";
import { CodeBlock4Example } from "@/components/component-gallery/examples/code-block/code-block-4";
import { CodeBlock5Example } from "@/components/component-gallery/examples/code-block/code-block-5";
import { CodeBlock6Example } from "@/components/component-gallery/examples/code-block/code-block-6";
import { CodeBlock7Example } from "@/components/component-gallery/examples/code-block/code-block-7";
import { CodeBlock8Example } from "@/components/component-gallery/examples/code-block/code-block-8";
import { CodeBlock9Example } from "@/components/component-gallery/examples/code-block/code-block-9";
import { CodeBlock10Example } from "@/components/component-gallery/examples/code-block/code-block-10";
import { CodeBlock11Example } from "@/components/component-gallery/examples/code-block/code-block-11";
import { CodeBlock12Example } from "@/components/component-gallery/examples/code-block/code-block-12";
import { CodeBlock13Example } from "@/components/component-gallery/examples/code-block/code-block-13";
import { CodeBlock14Example } from "@/components/component-gallery/examples/code-block/code-block-14";
import { CodeBlock15Example } from "@/components/component-gallery/examples/code-block/code-block-15";
import { CodeBlock16Example } from "@/components/component-gallery/examples/code-block/code-block-16";
import { CodeBlock17Example } from "@/components/component-gallery/examples/code-block/code-block-17";
import { CodeBlock18Example } from "@/components/component-gallery/examples/code-block/code-block-18";
import { CodeBlock19Example } from "@/components/component-gallery/examples/code-block/code-block-19";
import { CodeBlock20Example } from "@/components/component-gallery/examples/code-block/code-block-20";
import { CodeBlock21Example } from "@/components/component-gallery/examples/code-block/code-block-21";
import { CodeBlock22Example } from "@/components/component-gallery/examples/code-block/code-block-22";
import { CodeBlock23Example } from "@/components/component-gallery/examples/code-block/code-block-23";
import { CodeBlock24Example } from "@/components/component-gallery/examples/code-block/code-block-24";
import { CodeBlock25Example } from "@/components/component-gallery/examples/code-block/code-block-25";
import { CodeBlock26Example } from "@/components/component-gallery/examples/code-block/code-block-26";
import { CodeBlock27Example } from "@/components/component-gallery/examples/code-block/code-block-27";

export const CODE_BLOCK_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-code-block-1", label: "Basic", component: CodeBlock1Example },
	{ id: "c-code-block-2", label: "Pinned Copy", component: CodeBlock2Example },
	{ id: "c-code-block-3", label: "Streaming Agent", component: CodeBlock3Example },
	{ id: "c-code-block-4", label: "AI Chat", component: CodeBlock4Example },
	{ id: "c-code-block-5", label: "Diff Summary", component: CodeBlock5Example },
	{ id: "c-code-block-6", label: "Transformer Diff", component: CodeBlock6Example },
	{ id: "c-code-block-7", label: "Highlights", component: CodeBlock7Example },
	{ id: "c-code-block-8", label: "Focus Walkthrough", component: CodeBlock8Example },
	{ id: "c-code-block-9", label: "Terminal Output", component: CodeBlock9Example },
	{ id: "c-code-block-10", label: "Long File", component: CodeBlock10Example },
	{ id: "c-code-block-11", label: "Diagnostics & Actions", component: CodeBlock11Example },
	{ id: "c-code-block-12", label: "Line Selection", component: CodeBlock12Example },
	{ id: "c-code-block-13", label: "Search In File", component: CodeBlock13Example },
	{ id: "c-code-block-14", label: "File Tabs", component: CodeBlock14Example },
	{ id: "c-code-block-15", label: "Pre-Highlighted Lines", component: CodeBlock15Example },
	{ id: "c-code-block-16", label: "Before & After", component: CodeBlock16Example },
	{ id: "c-code-block-17", label: "Soft Wrap", component: CodeBlock17Example },
	{ id: "c-code-block-18", label: "Unified Patch", component: CodeBlock18Example },
	{ id: "c-code-block-19", label: "Design Token Theme", component: CodeBlock19Example },
	{ id: "c-code-block-20", label: "Always Dark", component: CodeBlock20Example },
	{ id: "c-code-block-21", label: "Dark Terminal", component: CodeBlock21Example },
	{ id: "c-code-block-22", label: "Accept & Reject", component: CodeBlock22Example },
	{ id: "c-code-block-23", label: "Code Folding", component: CodeBlock23Example },
	{ id: "c-code-block-24", label: "Fix With AI", component: CodeBlock24Example },
	{ id: "c-code-block-25", label: "Reference Lines", component: CodeBlock25Example },
	{ id: "c-code-block-26", label: "External Scroll", component: CodeBlock26Example },
	{ id: "c-code-block-27", label: "ANSI Terminal", component: CodeBlock27Example },
];

export function CodeBlockExamples(): React.JSX.Element {
	return <ExampleGrid examples={CODE_BLOCK_EXAMPLES} />;
}
