"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import { AlertOctagon, AlertTriangle, Check, Info, Lightbulb } from "lucide-react";
import * as React from "react";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

import { QuoteKindSchema, type QuoteKind } from "@/lib/mdx-plugins";

/**
 * Callout — color-tinted aside for `> [!NOTE]` alerts. Icon sits inline at the
 * start of the first line (same flow as body copy), using the docs sans stack.
 */

const QUOTE_KIND_CLASSES: Readonly<Record<QuoteKind, string>> = {
	info: "border-blue-200/80 bg-blue-50/80 text-blue-950 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-100",
	tip: "border-emerald-200/80 bg-emerald-50/80 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100",
	warning: "border-amber-200/80 bg-amber-50/80 text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100",
	error: "border-red-200/80 bg-red-50/80 text-red-950 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100",
	success: "border-teal-200/80 bg-teal-50/80 text-teal-950 dark:border-teal-400/25 dark:bg-teal-500/10 dark:text-teal-100",
};

const QUOTE_KIND_ICONS: Readonly<Record<QuoteKind, React.ComponentType<{ readonly className?: string }>>> = {
	info: Info,
	tip: Lightbulb,
	warning: AlertTriangle,
	error: AlertOctagon,
	success: Check,
};

const CALLOUT_BODY =
	"font-sans text-base leading-7 text-pretty not-italic [&_p]:m-0 [&_p]:font-sans [&_p]:text-base [&_p]:leading-7 [&_p]:text-pretty [&_p]:not-italic [&_p+p]:mt-4 [&_strong]:font-semibold";

export interface CalloutProps {
	readonly type?: string;
	readonly title?: string;
	readonly className?: string;
	readonly children: ReactNode;
}

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

type BlockElement = ReactElement<{ className?: string; children?: ReactNode }>;

function prependInlineIcon(block: ReactNode, icon: ReactNode): ReactNode {
	if (!isValidElement<{ className?: string; children?: ReactNode }>(block)) {
		return (
			<p className={CALLOUT_BODY}>
				{icon}
				{block}
			</p>
		);
	}
	const blockElement: BlockElement = block;
	return cloneElement(blockElement, {
		className: cn(CALLOUT_BODY, blockElement.props.className),
		children: (
			<>
				{icon}
				{blockElement.props.children}
			</>
		),
	});
}

function withLeadingIcon(children: ReactNode, icon: ReactNode): ReactNode {
	const items = Children.toArray(children);
	if (items.length === 0) {
		return <p className={CALLOUT_BODY}>{icon}</p>;
	}
	const [first, ...rest] = items;
	return [prependInlineIcon(first, icon), ...rest];
}

export function Callout({ type, title, className, children }: CalloutProps): React.JSX.Element {
	const kindResult = QuoteKindSchema.safeParse(type);
	const kind: QuoteKind = kindResult.success ? kindResult.data : "info";
	const Icon = QUOTE_KIND_ICONS[kind];

	const inlineIcon = <Icon className="me-1.5 inline size-[1.05em] shrink-0 align-[-0.15em]" aria-hidden />;

	const flattened = flattenToText(children);
	const titleMatch = /^\*\*([^*]+)\*\*\s*:?\s*(.*)$/s.exec(flattened);
	const explicitTitle = title ?? "";
	const detectedTitle = titleMatch?.[1] ?? "";
	const heading = explicitTitle.length > 0 ? explicitTitle : detectedTitle;
	const trailingPlain = titleMatch !== null && explicitTitle.length === 0 ? (titleMatch[2] ?? "").trim() : "";

	let content: ReactNode;
	if (heading.length > 0 && trailingPlain.length > 0) {
		content = (
			<p className={CALLOUT_BODY}>
				{inlineIcon}
				<strong className="font-semibold">{heading}</strong> {trailingPlain}
			</p>
		);
	} else if (heading.length > 0 && titleMatch !== null && explicitTitle.length === 0) {
		content = withLeadingIcon(children, inlineIcon);
	} else if (heading.length > 0) {
		content = (
			<>
				<p className={CALLOUT_BODY}>
					{inlineIcon}
					<strong className="font-semibold">{heading}</strong>
				</p>
				{explicitTitle.length > 0 ? children : null}
			</>
		);
	} else {
		content = withLeadingIcon(children, inlineIcon);
	}

	return (
		<aside className={cn("docs-callout my-6 rounded-xl border px-4 py-3.5 font-sans not-italic shadow-sm", QUOTE_KIND_CLASSES[kind], className)}>
			<div className="min-w-0">{content}</div>
		</aside>
	);
}
