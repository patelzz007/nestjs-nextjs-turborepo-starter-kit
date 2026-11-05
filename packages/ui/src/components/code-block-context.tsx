"use client";

// The code block's labels, contexts and hooks (enhancement 8.1: split from code-block.tsx): configuration, document, header, actions, folding
// and selection.

import { type CodeBlockLine, type CodeBlockLineActionsRender } from "@workspace/ui/components/code-block-highlight";
import { isBrowserRuntime } from "@workspace/shared";
import * as React from "react";
import { type CodeBlockFoldRegion } from "./code-block-model";

/**
 * Every user-facing string the block renders or announces - the `codeBlock`
 * family of the kit's `UiKitLabels` registry. The kit ships no copy of its
 * own: the app's `UiKitLabelsProvider` supplies it (e.g. `UI_KIT_LABELS_EN`),
 * and the root's optional `labels` prop overrides individual strings for one
 * block. Parameterised strings are functions so word order stays translatable.
 */
export interface CodeBlockLabels {
	/** Copy button accessible name while idle. */
	readonly copy: string;
	/** Copy button accessible name after a successful copy. */
	readonly copied: string;
	/** Download button accessible name. */
	readonly download: string;
	/** Wrap toggle text while lines do not wrap. */
	readonly wrap: string;
	/** Wrap toggle text while lines wrap. */
	readonly noWrap: string;
	/** Expand control text while collapsed under `maxLines`. */
	readonly showMore: string;
	/** Expand control text while expanded. */
	readonly showLess: string;
	/** Code region name when neither `label` nor `language` is set. */
	readonly code: string;
	/** Code region name derived from the language, e.g. "tsx code". */
	readonly languageCode: (language: string) => string;
	/** Selectable listbox name, derived from the region name. */
	readonly lines: (regionLabel: string) => string;
	/** Fold toggle accessible name for an open region (displayed numbers). */
	readonly foldLines: (from: number, to: number) => string;
	/** Fold toggle accessible name for a folded region (displayed numbers). */
	readonly unfoldLines: (from: number, to: number) => string;
	/** Folded-region chip accessible name. */
	readonly unfoldHiddenLines: (count: number) => string;
	/** Folded-region chip text. */
	readonly hiddenLines: (count: number) => string;
	/** Screen-reader announcement when a stream finishes. */
	readonly complete: (lineCount: number) => string;
}

/* -------------------------------------------------------------------------- */
/*                                   Context                                   */
/* -------------------------------------------------------------------------- */

/**
 * Two contexts: the document changes on every streamed chunk, the config does
 * not. Splitting them keeps a stream from re-rendering the chrome per chunk.
 */
export interface CodeBlockConfigValue {
	language?: string | undefined;
	resolvedLanguage?: string | undefined;
	showLineNumbers: boolean;
	wrap: boolean;
	setWrap: (wrap: boolean) => void;
	wrapControlled: boolean;
	expanded: boolean;
	setExpanded: (expanded: boolean) => void;
	collapsible: boolean;
	streaming: boolean;
	contentId: string;
	labels: CodeBlockLabels;
}

export interface CodeBlockDocumentValue {
	code: string;
	lines: CodeBlockLine[];
	selected: Set<number>;
	selectable: boolean;
	toggleLine: (line: number, extend: boolean) => void;
	clearSelection: () => void;
	foldable: boolean;
	foldRegions: CodeBlockFoldRegion[];
	folded: Set<number>;
	toggleFold: (start: number) => void;
	setFolded: (folded: number[]) => void;
}

export const CodeBlockConfigContext = React.createContext<CodeBlockConfigValue | null>(null);
export const CodeBlockDocumentContext = React.createContext<CodeBlockDocumentValue | null>(null);

/** Lets the copy button tell a header placement from a floating one. */
export const CodeBlockHeaderContext = React.createContext(false);

export interface CodeBlockSurfaceProps {
	lines: CodeBlockLine[];
	wrap: boolean;
	startLine: number;
	showLineNumbers: boolean;
	focusMode: boolean;
	selectable: boolean;
	selectedSet: Set<number>;
	toggleLine: (line: number, extend: boolean) => void;
	visibleLines?: number | undefined;
	gutterMax: number;
	foldable: boolean;
	gutterChannel: boolean;
	actionsSide: CodeBlockLineActionsSide;
	foldStarts: Map<number, CodeBlockFoldRegion>;
	foldedSet: Set<number>;
	onToggleFold: (start: number) => void;
	expandClearance: boolean;
	streaming: boolean;
	label: string;
	labels: CodeBlockLabels;
	contentId: string;
	actions?: CodeBlockLineActionsRender | null | undefined;
	completeAnnouncement?: string | undefined;
	/** true when the root rendered its own surface (no CodeBlockContent found). */
	builtInSurfaceRendered?: boolean | undefined;
	/** false = no scroll container of its own; an ancestor scrolls instead. */
	scroll?: boolean | undefined;
	className?: string | undefined;
}

/**
 * The root prepares every prop the code surface needs and publishes the
 * bundle here. `CodeBlockContent` reads it to render the surface wherever the
 * consumer composed it - typically inside their own ScrollArea - and the root
 * renders its built-in scrolling surface only when no `CodeBlockContent` is
 * found among its children.
 */
export const CodeBlockSurfacePropsContext = React.createContext<CodeBlockSurfaceProps | null>(null);

/**
 * `CodeBlockLineActions` renders nothing itself: it registers its render prop
 * here and the ACTIVE ROW renders it, so actions stay aligned when soft wrap
 * gives lines different heights.
 */
export type CodeBlockLineActionsSide = "end" | "gutter";

export interface CodeBlockActionsRegistry {
	register: (owner: object, render: CodeBlockLineActionsRender | null, side?: CodeBlockLineActionsSide) => void;
}

export const CodeBlockActionsContext = React.createContext<CodeBlockActionsRegistry | null>(null);

/* Next still server-renders "use client" files, and a bare useLayoutEffect
   logs on every SSR pass. Same alias the event calendar ships. */
export const useIsoLayoutEffect = isBrowserRuntime() ? React.useLayoutEffect : React.useEffect;

export function useInternalConfig(part: string): CodeBlockConfigValue {
	const context = React.useContext(CodeBlockConfigContext);
	if (!context) {
		throw new Error(`${part} must be used within a CodeBlock`);
	}
	return context;
}

/** The block's configuration plus its current source, for composed chrome. */
export type CodeBlockConfig = CodeBlockConfigValue & { code: string };

export function useCodeBlockConfig(part = "useCodeBlockConfig"): CodeBlockConfig {
	const context = React.useContext(CodeBlockConfigContext);
	const document = React.useContext(CodeBlockDocumentContext);
	if (!context || !document) {
		throw new Error(`${part} must be used within a CodeBlock`);
	}
	/* `code` lives on the DOCUMENT context (it changes per streamed chunk);
	   keeping it out of the config is what lets chrome that ignores the source
	   skip those re-renders. The public hook still returns it. */
	const code = document.code;
	return React.useMemo(() => ({ ...context, code }), [context, code]);
}

/* -------------------------------------------------------------------------- */
/*                                   Styling                                   */
/* -------------------------------------------------------------------------- */

/* Radius per style. Every style is named, including the zero rungs: a missing
   rung is a style someone forgot. The parity suite enforces all-eight-or-one. */
/** What `useCodeBlockFolding` returns. */
export interface CodeBlockFolding {
	foldable: boolean;
	regions: CodeBlockFoldRegion[];
	foldedStarts: number[];
	toggleFold: (start: number) => void;
	foldAll: () => void;
	unfoldAll: () => void;
}

/**
 * Live folding for anything composed inside the block - a "fold all" control,
 * a region count. Mirrors `useCodeBlockSelection`; region and start numbers
 * are source-based like every line spec.
 */
export function useCodeBlockFolding(): CodeBlockFolding {
	const document = React.useContext(CodeBlockDocumentContext);
	if (!document) {
		throw new Error("useCodeBlockFolding must be used within a CodeBlock");
	}

	const { foldable, foldRegions, folded, toggleFold, setFolded } = document;
	const foldedStarts = React.useMemo(() => [...folded].sort((a, b) => a - b), [folded]);
	const foldAll = React.useCallback((): void => {
		setFolded(foldRegions.map((region) => region.start));
	}, [setFolded, foldRegions]);
	const unfoldAll = React.useCallback((): void => {
		setFolded([]);
	}, [setFolded]);

	return {
		foldable,
		regions: foldRegions,
		foldedStarts,
		toggleFold,
		foldAll,
		unfoldAll,
	};
}

/** What `useCodeBlockSelection` returns. */
export interface CodeBlockSelection {
	selectable: boolean;
	selectedLines: number[];
	toggleLine: (line: number, extend: boolean) => void;
	clearSelection: () => void;
}

/**
 * Live selection for anything composed inside the block - a line action, a
 * header control. Returns the selected lines as a sorted array plus the same
 * toggle the rows use, so an "add selection to chat" affordance can act on the
 * whole range instead of only the hovered line.
 */
export function useCodeBlockSelection(): CodeBlockSelection {
	const document = React.useContext(CodeBlockDocumentContext);
	if (!document) {
		throw new Error("useCodeBlockSelection must be used within a CodeBlock");
	}

	const { selected, selectable, toggleLine, clearSelection } = document;
	const selectedLines = React.useMemo(() => [...selected].sort((a, b) => a - b), [selected]);

	return { selectable, selectedLines, toggleLine, clearSelection };
}

/* Re-exported so a consumer wires an AI transcript (markdown, terminal output,
   patches) from one import path, as ReUI does. A server component imports them
   from `code-block-highlight` instead, which has no "use client" boundary. */
