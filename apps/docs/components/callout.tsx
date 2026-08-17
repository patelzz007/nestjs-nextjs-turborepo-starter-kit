"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AlertOctagon, AlertTriangle, Check, Info, Lightbulb } from "lucide-react";
import * as React from "react";
import { isValidElement, type ReactElement, type ReactNode } from "react";

import { QuoteKindSchema, type QuoteKind } from "@/lib/mdx-plugins";

/**
 * Callout — the color-coded blockquote card rendered for `> [!NOTE]`-style
 * alerts (and plain blockquotes, which get keyword-detected kinds). Ported
 * from the admin docs renderer:
 *
 * - `success` reuses `info`'s blue styling (a success callout reads exactly
 *   like an info callout), while `tip` gets its own violet hue.
 * - A leading `**Title:**` bold becomes the icon + title header line.
 * - Every callout renders the same standardized design — only color + icon
 *   vary by kind.
 */

const QUOTE_KIND_CLASSES: Readonly<Record<QuoteKind, string>> = {
	info: "border-blue-200/80 bg-blue-50/80 text-blue-950 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200",
	tip: "border-emerald-200/80 bg-emerald-50/80 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200",
	warning: "border-amber-200/80 bg-amber-50/80 text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200",
	error: "border-red-200/80 bg-red-50/80 text-red-950 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-200",
	success: "border-teal-200/80 bg-teal-50/80 text-teal-950 dark:border-teal-400/25 dark:bg-teal-500/10 dark:text-teal-200",
};

const QUOTE_KIND_ICONS: Readonly<Record<QuoteKind, React.ComponentType<{ readonly className?: string }>>> = {
	info: Info,
	tip: Lightbulb,
	warning: AlertTriangle,
	error: AlertOctagon,
	success: Check,
};

export interface CalloutProps {
	readonly type?: string;
	readonly title?: string;
	readonly className?: string;
	readonly children: ReactNode;
}

/** Flattens blockquote children to plain text (for callout title detection). */
function flattenToText(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") {
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map(flattenToText).join("");
	}
	if (isElementWithChildren(node)) {
		return flattenToText(node.props.children);
	}
	return "";
}

function isElementWithChildren(node: ReactNode): node is ReactElement & { props: { children: ReactNode } } {
	return isValidElement(node) && node.props !== null && typeof node.props === "object" && "children" in node.props;
}

export function Callout({ type, title, className, children }: CalloutProps): React.JSX.Element {
	const kindResult = QuoteKindSchema.safeParse(type);
	const kind: QuoteKind = kindResult.success ? kindResult.data : "info";
	const Icon = QUOTE_KIND_ICONS[kind];

	const flattened = flattenToText(children);
	const titleMatch = /^\*\*([^*]+)\*\*\s*:?\s*(.*)$/s.exec(flattened);
	const explicitTitle = title ?? "";
	const detectedTitle = titleMatch?.[1] ?? "";
	const heading = explicitTitle.length > 0 ? explicitTitle : detectedTitle;
	const body = titleMatch !== null && explicitTitle.length === 0 ? (titleMatch[2] ?? "") : "";

	return (
		<blockquote className={cn("my-6 rounded-xl border px-4 py-3.5 text-[15px] leading-7 shadow-sm", QUOTE_KIND_CLASSES[kind], className)}>
			{heading.length > 0 ? (
				<>
					<strong className="mb-1.5 flex items-center gap-2 font-semibold">
						<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-black/[0.05] dark:bg-white/10">
							<Icon className="size-3.5 shrink-0" />
						</span>
						{heading}
					</strong>
					{body.length > 0 ? <div>{body}</div> : children}
				</>
			) : (
				<div className="flex items-start gap-2.5">
					<span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-black/[0.05] dark:bg-white/10">
						<Icon className="size-3.5 shrink-0" />
					</span>
					<div className="min-w-0 flex-1">{children}</div>
				</div>
			)}
		</blockquote>
	);
}
