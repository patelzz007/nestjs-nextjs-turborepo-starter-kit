"use client";

// The code block's header and controls (enhancement 8.1: split from code-block.tsx): title, language, copy, wrap, expand, download and line actions.

import { type CodeBlockLineActionsRender, stripNotationComments } from "@workspace/ui/components/code-block-highlight";
import { Button } from "@workspace/ui/components/button";
import { hasGlobalValue, isBrowserRuntime } from "@workspace/shared";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";
import {
	CodeBlockActionsContext,
	CodeBlockConfigContext,
	CodeBlockDocumentContext,
	type CodeBlockDocumentValue,
	CodeBlockHeaderContext,
	type CodeBlockLabels,
	type CodeBlockLineActionsSide,
	useInternalConfig,
} from "./code-block-context";
import { COPY_FAILED_FEEDBACK_MS, DEFAULT_COPY_FEEDBACK_MS, DOWNLOAD_REVOKE_DELAY_MS, PINNED_CONTROL_CLASS, PINNED_HOVER_REVEAL_CLASS } from "./code-block-styles";

/**
 * Opt-in header. Absent, the block renders no chrome, so it nests in a Card or
 * Frame without a doubled bar. Presence flips `data-has-header` on the root,
 * detected from the element type rather than a `:has()` selector.
 */
export const CodeBlockHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(function CodeBlockHeader(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<CodeBlockHeaderContext.Provider value>
			<div ref={ref} data-slot="code-block-header" className={cn("flex min-h-9 shrink-0 items-center gap-2 border-b border-border px-3 py-0 text-sm", className)} {...props} />
		</CodeBlockHeaderContext.Provider>
	);
});

export const CodeBlockTitle = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(function CodeBlockTitle(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <div ref={ref} data-slot="code-block-title" className={cn("min-w-0 truncate font-mono text-xs text-muted-foreground", className)} {...props} />;
});

/**
 * The resolved language as a label, no props needed. It shows what the
 * highlighter actually resolved, so an unsupported grammar becomes visible
 * instead of silently rendering plain.
 */
export const CodeBlockLanguage = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<"span">>(function CodeBlockLanguage(
	{ className, children, ...props },
	ref,
): React.JSX.Element | null {
	const { language, resolvedLanguage } = useInternalConfig("CodeBlockLanguage");
	const label = children ?? resolvedLanguage ?? language;

	if (!label) return null;

	return (
		<span
			ref={ref}
			data-slot="code-block-language"
			data-unsupported={!resolvedLanguage ? true : undefined}
			className={cn(
				"inline-flex shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[0.6875rem] leading-none text-muted-foreground uppercase",
				className,
			)}
			{...props}>
			{label}
		</span>
	);
});

/* -------------------------------------------------------------------------- */
/*                                  Copy button                                */
/* -------------------------------------------------------------------------- */

export function CopyIcon({ copied }: { readonly copied: boolean }): React.JSX.Element {
	return copied ? (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M20 6 9 17l-5-5" />
		</svg>
	) : (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
			<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
		</svg>
	);
}

export type CodeBlockButtonProps = React.ComponentPropsWithoutRef<typeof Button>;
export type CodeBlockButtonClickEvent = Parameters<NonNullable<CodeBlockButtonProps["onClick"]>>[0];

/** `pinned` floats over the surface; `inline` sits in a header. */
export type CodeBlockControlPosition = "auto" | "pinned" | "inline";

export type CodeBlockCopyButtonProps = {
	value?: string;
	timeout?: number;
	onCopy?: (value: string) => void;
	/** The clipboard's rejection, normalised to an `Error` (original on `cause`). */
	onCopyError?: (error: Error) => void;
	/** Accessible names, for localisation. Override the root's `labels`. */
	labels?: { copy?: string; copied?: string };
	/** `pinned` floats over the surface; `inline` sits in a header. */
	position?: CodeBlockControlPosition;
	alwaysVisible?: boolean;
} & Omit<CodeBlockButtonProps, "value" | "onCopy">;

/**
 * The block's source for copy and download. Server-highlighted blocks pass
 * `lines` and no `code`, so the document text is the fallback; without it the
 * control rendered but did nothing on the exact path the docs advertise.
 */
export function documentText(document: CodeBlockDocumentValue | null): string {
	if (!document) return "";
	if (document.code.length > 0) return document.code;
	return document.lines.map((line) => line.text).join("\n");
}

/**
 * The labels a chrome part speaks: the root's (provider copy plus the root's
 * `labels` override), or - for a part rendered outside any CodeBlock, which
 * has no root to take them from - the provider's `codeBlock` family. Per-part
 * `labels`/`label` props override either.
 */
export function useChromeLabels(): CodeBlockLabels {
	const rootLabels = React.useContext(CodeBlockConfigContext)?.labels;
	const providerLabels = useUiKitLabels("codeBlock");
	return rootLabels ?? providerLabels;
}

export function resolvePosition(position: CodeBlockControlPosition, inHeader: boolean): "pinned" | "inline" {
	if (position !== "auto") return position;
	return inHeader ? "inline" : "pinned";
}

/**
 * Copy button. Inline inside a header, pinned over the surface anywhere else.
 * Pinning is absolute against the root, not `position: sticky`: sticky still
 * slides away under HORIZONTAL scroll, and code scrolls sideways constantly.
 * Notation comments are stripped from the payload, matching what is rendered.
 */
export const CodeBlockCopyButton = React.forwardRef<HTMLElement, CodeBlockCopyButtonProps>(function CodeBlockCopyButton(
	{ value, timeout = DEFAULT_COPY_FEEDBACK_MS, onCopy, onCopyError, labels, position = "auto", alwaysVisible = false, className, variant = "ghost", size, children, ...props },
	ref,
): React.JSX.Element {
	const rootLabels = useChromeLabels();
	const inHeader = React.useContext(CodeBlockHeaderContext);
	const [copied, setCopied] = React.useState(false);
	const [copyFailed, setCopyFailed] = React.useState(false);

	const resolvedPosition = resolvePosition(position, inHeader);

	/* A header is chrome, so the button takes the smaller icon rung there and the
	   full one when it floats over the code. Both are per-style ladders in the
	   shadcn button, so this stays style-aware instead of pinning a pixel size. */
	const resolvedSize = size ?? (resolvedPosition === "inline" ? "icon-sm" : "icon");

	React.useEffect(() => {
		if (!copied || timeout === 0) return;
		const id = window.setTimeout(() => {
			setCopied(false);
		}, timeout);
		return (): void => {
			window.clearTimeout(id);
		};
	}, [copied, timeout]);

	React.useEffect(() => {
		if (!copyFailed) return;
		const id = window.setTimeout(() => {
			setCopyFailed(false);
		}, COPY_FAILED_FEEDBACK_MS);
		return (): void => {
			window.clearTimeout(id);
		};
	}, [copyFailed]);

	const blockDocument = React.useContext(CodeBlockDocumentContext);

	const handleClick = React.useCallback((): void => {
		const payload = stripNotationComments(value ?? documentText(blockDocument));
		if (!payload) return;
		/* Widened on purpose: the DOM typings promise a clipboard, but insecure
		   origins and non-browser DOMs have none. */
		const clipboard: Clipboard | undefined = hasGlobalValue("navigator") ? navigator.clipboard : undefined;
		if (!clipboard) return;

		/* Rejection is routine: a denied permission, or a document that lost
		   focus. Without the handler it surfaced as an unhandled rejection in
		   the consumer's error monitoring. Only the write's own rejection is
		   a failed copy — never an error thrown by `onCopy`. */
		const written: Promise<boolean> = clipboard
			.writeText(payload)
			.then((): boolean => true)
			.catch((error: unknown): boolean => {
				setCopyFailed(true);
				onCopyError?.(error instanceof Error ? error : new Error("Clipboard write failed", { cause: error }));
				return false;
			});
		void written.then((isWritten: boolean): void => {
			if (isWritten) {
				setCopied(true);
				onCopy?.(payload);
			}
		});
	}, [value, blockDocument, onCopy, onCopyError]);

	return (
		<Button
			ref={ref}
			type="button"
			data-slot="code-block-copy"
			data-copied={copied ? true : undefined}
			data-copy-failed={copyFailed ? true : undefined}
			data-position={resolvedPosition}
			aria-label={copied ? (labels?.copied ?? rootLabels.copied) : (labels?.copy ?? rootLabels.copy)}
			variant={variant}
			size={resolvedSize}
			onClick={handleClick}
			className={cn(
				"shrink-0 [&_svg]:size-3.5",
				/* Physical `right`, not logical `end`: the code surface is forced
				   dir="ltr", so in an RTL app the logical inset landed the button
				   over the first characters instead of the trailing edge. */
				resolvedPosition === "pinned" ? PINNED_CONTROL_CLASS : undefined,
				resolvedPosition === "pinned" && !alwaysVisible ? PINNED_HOVER_REVEAL_CLASS : undefined,
				className,
			)}
			{...props}>
			{children ?? <CopyIcon copied={copied} />}
		</Button>
	);
});

/* -------------------------------------------------------------------------- */
/*                              Wrap and expand                                */
/* -------------------------------------------------------------------------- */

export const CodeBlockWrapToggle = React.forwardRef<HTMLElement, CodeBlockButtonProps>(function CodeBlockWrapToggle(
	{ className, children, variant = "ghost", size = "sm", onClick, ...props },
	ref,
): React.JSX.Element {
	const { wrap, setWrap, labels } = useInternalConfig("CodeBlockWrapToggle");

	const handleClick = React.useCallback(
		(event: CodeBlockButtonClickEvent): void => {
			onClick?.(event);
			if (!event.defaultPrevented) setWrap(!wrap);
		},
		[onClick, setWrap, wrap],
	);

	return (
		<Button
			ref={ref}
			type="button"
			data-slot="code-block-wrap-toggle"
			data-state={wrap ? "on" : "off"}
			aria-pressed={wrap}
			variant={variant}
			size={size}
			onClick={handleClick}
			className={cn("shrink-0", className)}
			{...props}>
			{children ?? (wrap ? labels.noWrap : labels.wrap)}
		</Button>
	);
});

/**
 * Expands a block collapsed by `maxLines`.
 *
 * Renders nothing when the content is shorter than the cut, so a consumer can
 * always compose it without guarding on line count themselves. `className`
 * styles the floating wrapper; the ref and every other prop reach the button.
 */
export const CodeBlockExpandButton = React.forwardRef<HTMLElement, CodeBlockButtonProps>(function CodeBlockExpandButton(
	{ className, children, variant = "ghost", size = "sm", onClick, ...props },
	ref,
): React.JSX.Element | null {
	const { expanded, setExpanded, collapsible, contentId, labels } = useInternalConfig("CodeBlockExpandButton");

	const handleClick = React.useCallback(
		(event: CodeBlockButtonClickEvent): void => {
			onClick?.(event);
			if (!event.defaultPrevented) setExpanded(!expanded);
		},
		[onClick, setExpanded, expanded],
	);

	if (!collapsible) return null;

	return (
		<div
			data-slot="code-block-expand"
			data-state={expanded ? "expanded" : "collapsed"}
			className={cn(
				/* Both states float over the surface. Expanded used to rejoin the flex
				   column as a bordered strip, which read as a card footer and moved the
				   block's bottom edge on the first click; the surface reserves a row of
				   clearance instead, so only the label changes. */
				"absolute inset-x-0 bottom-0 z-10 order-last flex items-end justify-center pt-10 pb-2",
				/* The fade means "there is more below", so it belongs to the collapsed
				   state only. Expanded, the surface already reserves a clear row for
				   this control, and keeping the gradient just dimmed the last real
				   line of code. */
				!expanded ? "bg-linear-to-t from-card via-card/85 to-transparent" : undefined,
				className,
			)}>
			<Button ref={ref} type="button" aria-expanded={expanded} aria-controls={contentId} variant={variant} size={size} onClick={handleClick} {...props}>
				{children ?? (expanded ? labels.showLess : labels.showMore)}
			</Button>
		</div>
	);
});

/* -------------------------------------------------------------------------- */
/*                                 Line actions                                */
/* -------------------------------------------------------------------------- */

export interface CodeBlockLineActionsProps {
	children: CodeBlockLineActionsRender;
	/**
	 * `end` floats the group over the end of the active row. `gutter` puts it in
	 * the channel beside the line number, which is where a "add this line"
	 * affordance belongs. A fold toggle owns that channel when both are on, so a
	 * gutter action on a fold-start row falls back to `end`.
	 */
	side?: CodeBlockLineActionsSide;
}

/** File extension per resolved language, for the download button's default name. */
export const LANGUAGE_EXTENSIONS: Record<string, string> = {
	bash: "sh",
	c: "c",
	cpp: "cpp",
	csharp: "cs",
	css: "css",
	diff: "patch",
	docker: "dockerfile",
	go: "go",
	graphql: "graphql",
	html: "html",
	java: "java",
	javascript: "js",
	json: "json",
	jsx: "jsx",
	kotlin: "kt",
	markdown: "md",
	php: "php",
	python: "py",
	ruby: "rb",
	rust: "rs",
	sql: "sql",
	swift: "swift",
	toml: "toml",
	tsx: "tsx",
	typescript: "ts",
	xml: "xml",
	yaml: "yaml",
};

export function extensionFor(language: string | undefined): string {
	if (language === undefined || !Object.hasOwn(LANGUAGE_EXTENSIONS, language)) return "txt";
	return LANGUAGE_EXTENSIONS[language] ?? "txt";
}

export type CodeBlockDownloadButtonProps = {
	/** Text to save. Defaults to the block's code with notation stripped. */
	value?: string;
	/** Defaults to `code.<ext>` from the block's language. */
	filename?: string;
	onDownload?: (filename: string) => void;
	/** `pinned` floats over the surface; `inline` sits in a header. */
	position?: CodeBlockControlPosition;
	alwaysVisible?: boolean;
	/** Accessible name, for localisation. Overrides the root's `labels.download`. */
	label?: string;
} & Omit<CodeBlockButtonProps, "value">;

/**
 * Saves the block's code as a file - the sibling the copy button was missing
 * for builder-style output, where the result IS a file and disk is the next
 * step. Same placement contract as the copy button.
 */
export const CodeBlockDownloadButton = React.forwardRef<HTMLElement, CodeBlockDownloadButtonProps>(function CodeBlockDownloadButton(
	{ value, filename, onDownload, position = "auto", alwaysVisible = false, label, className, variant = "ghost", size, children, ...props },
	ref,
): React.JSX.Element {
	const context = React.useContext(CodeBlockConfigContext);
	const blockDocument = React.useContext(CodeBlockDocumentContext);
	const inHeader = React.useContext(CodeBlockHeaderContext);
	const rootLabels = useChromeLabels();

	const resolvedPosition = resolvePosition(position, inHeader);
	const resolvedSize = size ?? (resolvedPosition === "inline" ? "icon-sm" : "icon");
	const resolvedLanguage = context?.resolvedLanguage;

	const handleClick = React.useCallback((): void => {
		const payload = stripNotationComments(value ?? documentText(blockDocument));
		if (!payload || !isBrowserRuntime()) return;

		const name = filename ?? `code.${extensionFor(resolvedLanguage)}`;
		const url = URL.createObjectURL(new Blob([payload], { type: "text/plain;charset=utf-8" }));
		const anchor = window.document.createElement("a");
		anchor.href = url;
		anchor.download = name;
		anchor.click();
		/* Deferred: revoking synchronously races the browser starting the save. */
		window.setTimeout(() => {
			URL.revokeObjectURL(url);
		}, DOWNLOAD_REVOKE_DELAY_MS);
		onDownload?.(name);
	}, [value, filename, resolvedLanguage, blockDocument, onDownload]);

	return (
		<Button
			ref={ref}
			type="button"
			data-slot="code-block-download"
			data-position={resolvedPosition}
			aria-label={label ?? rootLabels.download}
			variant={variant}
			size={resolvedSize}
			onClick={handleClick}
			className={cn(
				"shrink-0 [&_svg]:size-3.5",
				resolvedPosition === "pinned" ? PINNED_CONTROL_CLASS : undefined,
				resolvedPosition === "pinned" && !alwaysVisible ? PINNED_HOVER_REVEAL_CLASS : undefined,
				className,
			)}
			{...props}>
			{children ?? (
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
				</svg>
			)}
		</Button>
	);
});

/**
 * Actions on the hovered or focused line. ONE group exists for the whole
 * block, rendered inside the active row: a 2,000 line file mounts one button
 * group, not 2,000.
 */
export function CodeBlockLineActions({ children, side = "end" }: CodeBlockLineActionsProps): null {
	const registry = React.useContext(CodeBlockActionsContext);
	/* A stable identity token for this mount; state rather than a ref so it is
	   never read from a ref during render. */
	const [owner] = React.useState<object>(() => ({}));

	React.useEffect(() => {
		registry?.register(owner, children, side);
		return (): void => {
			registry?.register(owner, null);
		};
	}, [registry, owner, children, side]);

	return null;
}
