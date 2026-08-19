"use client";

import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

/**
 * Remaining prose element overrides for the docs renderer — paragraphs, lists,
 * inline code, emphasis and task-list markers, matching the admin docs
 * typography.
 */

export function ProseParagraph({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
	return (
		<p className={cn("text-base leading-7 text-pretty text-foreground/90 not-first:mt-4", className)} {...props}>
			{children}
		</p>
	);
}

export function InlineCode({ className, children, ...props }: React.HTMLAttributes<HTMLElement>): React.JSX.Element {
	return (
		<code className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-foreground", className)} {...props}>
			{children}
		</code>
	);
}

export function ProseStrong({ className, children, ...props }: React.HTMLAttributes<HTMLElement>): React.JSX.Element {
	return (
		<strong className={cn("font-semibold text-foreground", className)} {...props}>
			{children}
		</strong>
	);
}

export function ProseEm({ className, children, ...props }: React.HTMLAttributes<HTMLElement>): React.JSX.Element {
	return (
		<em className={className} {...props}>
			{children}
		</em>
	);
}

export function ProseUl({ className, children, ...props }: React.HTMLAttributes<HTMLUListElement>): React.JSX.Element {
	return (
		<ul className={cn("my-4 ml-5 list-disc space-y-2 text-base leading-7 marker:text-muted-foreground/60", className)} {...props}>
			{children}
		</ul>
	);
}

export function ProseOl({ className, children, ...props }: React.HTMLAttributes<HTMLOListElement>): React.JSX.Element {
	return (
		<ol className={cn("my-4 ml-5 list-decimal space-y-2 text-base leading-7 marker:text-muted-foreground/60", className)} {...props}>
			{children}
		</ol>
	);
}

export function ProseLi({ className, children, ...props }: React.LiHTMLAttributes<HTMLLIElement>): React.JSX.Element {
	return (
		<li className={cn("text-base leading-7", className)} {...props}>
			{children}
		</li>
	);
}

export function ProseHr({ className, ...props }: React.HTMLAttributes<HTMLHRElement>): React.JSX.Element {
	return <hr className={cn("my-10 border-border/60", className)} {...props} />;
}

export function ProseInput({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>): React.JSX.Element | null {
	// Task-list checkboxes are rendered as text markers by remarkTaskCheckboxPlugin.
	if (type === "checkbox") {
		return null;
	}
	return <input type={type} className={className} {...props} />;
}
