"use client";

// Title: Code Block
// Description: Shadcn code block with Shiki highlighting, streaming, diffs, folding and per-line interaction for AI chat UIs.
// Ported from ReUI (https://reui.io/r/base-vega/code-block.json). Every part,
// prop, data attribute and behaviour of the original is kept; the deliberate
// deviations (kit labels, forwarded refs, lint-driven restructuring, the
// token-backed ANSI palette) are listed in packages/ui/README.md.
import {
	ansiToLines,
	highlightCode,
	markdownCodeProps,
	markdownFences,
	parseUnifiedDiff,
	resolveCodeBlockLanguage,
	toPlainLines,
	type CodeBlockDiffSpec,
	type CodeBlockHighlightOptions,
	type CodeBlockLevelSpec,
	type CodeBlockLine,
	type CodeBlockLineActionsRender,
	type CodeBlockLineSpec,
	type CodeBlockThemes,
	type CodeBlockTransformer,
	type CodeBlockWordSpec,
} from "@workspace/ui/components/code-block-highlight";
import { isNumberPrimitive } from "@workspace/shared";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";
import {
	CodeBlockActionsContext,
	type CodeBlockActionsRegistry,
	CodeBlockConfigContext,
	type CodeBlockConfigValue,
	CodeBlockDocumentContext,
	type CodeBlockDocumentValue,
	type CodeBlockLineActionsSide,
	CodeBlockSurfacePropsContext,
	useCodeBlockConfig,
	useCodeBlockFolding,
	useCodeBlockSelection,
	useIsoLayoutEffect,
	type CodeBlockSurfaceProps,
} from "./code-block-context";
import {
	CodeBlockCopyButton,
	CodeBlockDownloadButton,
	CodeBlockExpandButton,
	CodeBlockHeader,
	CodeBlockLanguage,
	CodeBlockLineActions,
	CodeBlockTitle,
	CodeBlockWrapToggle,
} from "./code-block-controls";
import { type CodeBlockFoldRegion, EMPTY_FOLD_REGIONS, computeFoldRegions } from "./code-block-model";
import { ROOT_BASE_CLASS, ROOT_GHOST_CLASS, ROOT_RADIUS_CLASS, ROOT_SURFACE_CLASS, ROOT_TOKEN_CLASS } from "./code-block-styles";
import { CodeBlockContent, CodeBlockSurface, containsElementType } from "./code-block-surface";

export {
	type CodeBlockConfig,
	type CodeBlockConfigValue,
	type CodeBlockFolding,
	type CodeBlockLabels,
	type CodeBlockLineActionsSide,
	type CodeBlockSelection,
} from "./code-block-context";
export { type CodeBlockControlPosition, type CodeBlockCopyButtonProps, type CodeBlockDownloadButtonProps, type CodeBlockLineActionsProps } from "./code-block-controls";
export { type CodeBlockFoldRegion } from "./code-block-model";
export { type CodeBlockContentProps } from "./code-block-surface";

/* -------------------------------------------------------------------------- */
/*                                    Labels                                   */
/* -------------------------------------------------------------------------- */

export type CodeBlockProps = {
	code?: string | undefined;
	language?: string | undefined;
	lines?: CodeBlockLine[] | undefined;
	themes?: CodeBlockThemes | undefined;
	highlight?: boolean | undefined;
	showLineNumbers?: boolean | undefined;
	startLine?: number | undefined;
	wrap?: boolean | undefined;
	defaultWrap?: boolean | undefined;
	onWrapChange?: ((wrap: boolean) => void) | undefined;
	maxLines?: number | undefined;
	variant?: "default" | "ghost" | undefined;
	/** Accessible name of the code region. Defaults to `labels.languageCode(language)` / `labels.code`. */
	label?: string | undefined;
	/**
	 * Overrides some of the `codeBlock` strings from the app's
	 * `UiKitLabelsProvider` for this block and its parts. Keep the reference
	 * stable (a module constant or a memo) - it reaches every memoised row.
	 */
	labels?: UiKitLabelsOverride<"codeBlock"> | undefined;
	highlightedLines?: CodeBlockLineSpec | undefined;
	highlightedWords?: CodeBlockWordSpec[] | undefined;
	focusedLines?: CodeBlockLineSpec | undefined;
	diff?: CodeBlockDiffSpec | undefined;
	lineLevels?: CodeBlockLevelSpec | undefined;
	transformers?: CodeBlockTransformer[] | undefined;
	streaming?: boolean | undefined;
	selectable?: boolean | undefined;
	selectedLines?: number[] | undefined;
	defaultSelectedLines?: number[] | undefined;
	onSelectedLinesChange?: ((lines: number[]) => void) | undefined;
	/** Screen-reader text announced when a stream finishes, for localisation. Overrides `labels.complete`. */
	completeAnnouncement?: string | undefined;
	/** Collapsed state under `maxLines`, controlled. */
	expanded?: boolean | undefined;
	defaultExpanded?: boolean | undefined;
	onExpandedChange?: ((expanded: boolean) => void) | undefined;
	/** Detects fold regions from indentation and renders a toggle per region. */
	foldable?: boolean | undefined;
	/**
	 * Replaces the indentation heuristic with your own regions (source-numbered,
	 * like every line spec) - grammar folding, JSON blocks, patch hunks.
	 * Implies nothing about `foldable`; pass both.
	 */
	foldRegions?: CodeBlockFoldRegion[] | undefined;
	/** Folded regions by start line, 1-based within `code`. Controlled. */
	folded?: number[] | undefined;
	/** Folded regions by their start line, uncontrolled. */
	defaultFolded?: number[] | undefined;
	onFoldedChange?: ((folded: number[]) => void) | undefined;
	children?: React.ReactNode | undefined;
} & Omit<React.ComponentPropsWithoutRef<"div">, "children" | "onSelect">;

/* The presentation props the highlight effect reads. They reach it through a
   ref, keyed by the serialized `specKey` (see the effect). */
type HighlightSpec = Pick<CodeBlockHighlightOptions, "themes" | "startLine" | "highlightedLines" | "highlightedWords" | "focusedLines" | "diff" | "lineLevels">;

interface HighlightedDocument {
	source: string;
	spec: string;
	language: string | undefined;
	lines: CodeBlockLine[];
}

interface SelectionState {
	selection: number[];
	selectedSet: Set<number>;
	controlled: boolean;
	onSelectedLinesChange?: ((lines: number[]) => void) | undefined;
}

interface FoldState {
	foldedValue: number[];
	foldedSet: Set<number>;
	controlled: boolean;
	onFoldedChange?: ((folded: number[]) => void) | undefined;
}

/**
 * The root. `<CodeBlock code={code} language="tsx" />` is a complete block;
 * passing `lines` from a server component skips the client highlighter and
 * shiki entirely. Children are CHROME ONLY: the root renders the code surface
 * itself, so child order never matters and a wrapper cannot break scrolling.
 */
const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(function CodeBlock(
	{
		code,
		language,
		lines: linesProp,
		themes,
		highlight = true,
		showLineNumbers = false,
		startLine = 1,
		wrap: wrapProp,
		defaultWrap = false,
		onWrapChange,
		maxLines,
		variant = "default",
		label,
		labels: labelsOverride,
		highlightedLines,
		highlightedWords,
		focusedLines,
		diff,
		lineLevels,
		transformers,
		streaming = false,
		selectable = false,
		selectedLines,
		defaultSelectedLines,
		onSelectedLinesChange,
		completeAnnouncement,
		expanded: expandedProp,
		defaultExpanded = false,
		onExpandedChange,
		foldable = false,
		foldRegions: foldRegionsProp,
		folded,
		defaultFolded,
		onFoldedChange,
		className,
		children,
		...props
	},
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("codeBlock", labelsOverride);
	const contentId = React.useId();
	const source = code ?? "";
	const resolvedLanguage = resolveCodeBlockLanguage(language);

	/* The deferred copy is what a fast stream tokenises against. React keeps the
	   previous render on screen while the new one is prepared, so the block never
	   blanks and the main thread is never blocked by a chunk. */
	const deferredSource = React.useDeferredValue(source);

	const plainLines = React.useMemo(() => toPlainLines(deferredSource, startLine), [deferredSource, startLine]);

	/* The result is tagged with the exact inputs that produced it. Without the
	   tag, swapping `code` kept rendering the PREVIOUS document for the whole
	   async highlight pass - or spliced two files together when the old result
	   was shorter than the new source. */
	const [highlighted, setHighlighted] = React.useState<HighlightedDocument | null>(null);

	const shouldHighlight = !linesProp && highlight && Boolean(resolvedLanguage) && source.length > 0;

	/* Presentation props enter the effect as ONE serialized key: they are
	   inline literals at most call sites, and reference deps would re-tokenize
	   per parent render. The effect reads the live values from a ref that is
	   refreshed before it runs, so it always sees the props `specKey` was
	   built from. `transformers` holds functions and stays a reference dep -
	   hoist it to module scope. */
	const specKey = JSON.stringify([themes ?? null, startLine, highlightedLines ?? null, highlightedWords ?? null, focusedLines ?? null, diff ?? null, lineLevels ?? null]);
	const specRef = React.useRef<HighlightSpec>({ themes, startLine, highlightedLines, highlightedWords, focusedLines, diff, lineLevels });
	/* Declared before the highlight effect, so it runs first in every commit. */
	React.useEffect(() => {
		specRef.current = { themes, startLine, highlightedLines, highlightedWords, focusedLines, diff, lineLevels };
	});

	const transformersWarnedRef = React.useRef(false);
	const previousTransformersRef = React.useRef(transformers);
	React.useEffect(() => {
		if (process.env.NODE_ENV !== "production" && streaming && previousTransformersRef.current !== transformers && !transformersWarnedRef.current) {
			transformersWarnedRef.current = true;
			console.warn(
				"[code-block] `transformers` changed identity during a stream, which " +
					"re-tokenizes the whole document per chunk. Hoist the array to " +
					"module scope or memoize it.",
			);
		}
		previousTransformersRef.current = transformers;
	}, [transformers, streaming]);

	/* No reset to `null` when highlighting turns off: the `lines` memo below
	   already ignores the result then, and the result is tagged with source,
	   spec and language, so a stale one can never be shown. */
	React.useEffect(() => {
		if (!shouldHighlight) return;

		let active = true;
		void highlightCode(deferredSource, {
			...specRef.current,
			language,
			instanceKey: contentId,
			transformers,
		}).then((next) => {
			if (active) {
				setHighlighted({ source: deferredSource, spec: specKey, language, lines: next });
			}
		});

		return (): void => {
			active = false;
		};
	}, [shouldHighlight, deferredSource, language, transformers, specKey, contentId]);

	/* Plain text is the floor, never a blank frame: the highlighter runs a
	   chunk behind a stream, so its lines show as-is and the remainder appends
	   as plain text that gains colour a frame later. */
	const lines = React.useMemo((): CodeBlockLine[] => {
		if (linesProp) return linesProp;
		if (!shouldHighlight || !highlighted) return plainLines;
		/* The merge below is only valid under the STREAMING invariant: the
		   highlighted source must be a prefix of what is on screen, with the same
		   presentation spec. A swapped `code` or spec falls back to plain text
		   for one highlight pass instead of showing the previous document. */
		if (highlighted.spec !== specKey || highlighted.language !== language || !deferredSource.startsWith(highlighted.source)) {
			return plainLines;
		}
		if (highlighted.lines.length >= plainLines.length) return highlighted.lines;
		return [...highlighted.lines, ...plainLines.slice(highlighted.lines.length)];
	}, [linesProp, shouldHighlight, highlighted, plainLines, deferredSource, specKey, language]);

	const focusMode = React.useMemo(() => lines.some((line) => line.state?.focused), [lines]);

	const hasDiff = React.useMemo(() => lines.some((line) => line.state?.diff), [lines]);

	const [internalWrap, setInternalWrap] = React.useState(defaultWrap);
	const wrap = wrapProp ?? internalWrap;
	const setWrap = React.useCallback(
		(next: boolean): void => {
			if (wrapProp === undefined) setInternalWrap(next);
			onWrapChange?.(next);
		},
		[wrapProp, onWrapChange],
	);

	const collapsible = isNumberPrimitive(maxLines) && lines.length > maxLines;
	const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded);
	const expanded = expandedProp ?? internalExpanded;
	const setExpanded = React.useCallback(
		(next: boolean): void => {
			if (expandedProp === undefined) setInternalExpanded(next);
			onExpandedChange?.(next);
		},
		[expandedProp, onExpandedChange],
	);
	const isExpanded = collapsible ? expanded : true;

	const [internalSelected, setInternalSelected] = React.useState<number[]>(defaultSelectedLines ?? []);
	const selection = selectedLines ?? internalSelected;
	const selectedSet = React.useMemo(() => new Set(selection), [selection]);
	const lastSelectedRef = React.useRef<number | null>(null);

	/* Latest-value refs, so the toggle callbacks below can be created ONCE.
	   With state in their dep lists every selection or fold change minted new
	   identities, which reached every row through `onSelect`/`onToggleFold` and
	   busted the row memo the streaming design rests on. The ref is synced in a
	   layout effect rather than during render (a render-time ref write is
	   unsafe under concurrent rendering); every reader is an event handler,
	   which only runs after that commit. */
	const selectionState: SelectionState = {
		selection,
		selectedSet,
		controlled: selectedLines !== undefined,
		onSelectedLinesChange,
	};
	const selectionStateRef = React.useRef(selectionState);
	useIsoLayoutEffect(() => {
		selectionStateRef.current = selectionState;
	});

	const commitSelection = React.useCallback((next: number[]): void => {
		if (!selectionStateRef.current.controlled) setInternalSelected(next);
		selectionStateRef.current.onSelectedLinesChange?.(next);
	}, []);

	const toggleLine = React.useCallback(
		(line: number, extend: boolean): void => {
			const anchor = lastSelectedRef.current;
			const { selection: current, selectedSet: currentSet } = selectionStateRef.current;

			if (extend && anchor !== null) {
				const from = Math.min(anchor, line);
				const to = Math.max(anchor, line);
				const range: number[] = [];
				for (let value = from; value <= to; value += 1) range.push(value);
				commitSelection(range);
				return;
			}

			lastSelectedRef.current = line;
			commitSelection(currentSet.has(line) ? current.filter((value) => value !== line) : [...current, line].sort((a, b) => a - b));
		},
		[commitSelection],
	);

	/* Regions are SOURCE-numbered (1-based within `code`), like every other
	   line spec, so `folded` values and `highlightedLines` values interchange. */
	const foldRegions = React.useMemo((): CodeBlockFoldRegion[] => {
		if (!foldable) return EMPTY_FOLD_REGIONS;
		if (foldRegionsProp) return foldRegionsProp;
		return computeFoldRegions(lines).map((region) => ({
			start: region.start - startLine + 1,
			end: region.end - startLine + 1,
		}));
	}, [foldable, foldRegionsProp, lines, startLine]);

	const foldStarts = React.useMemo(() => new Map(foldRegions.map((region): [number, CodeBlockFoldRegion] => [region.start, region])), [foldRegions]);

	const [internalFolded, setInternalFolded] = React.useState<number[]>(defaultFolded ?? []);
	const foldedValue = folded ?? internalFolded;
	const foldedSet = React.useMemo(() => new Set(foldedValue), [foldedValue]);

	/* Same latest-value shape as selection, for the same row-memo reason. */
	const foldState: FoldState = {
		foldedValue,
		foldedSet,
		controlled: folded !== undefined,
		onFoldedChange,
	};
	const foldStateRef = React.useRef(foldState);
	useIsoLayoutEffect(() => {
		foldStateRef.current = foldState;
	});

	const commitFolded = React.useCallback((next: number[]): void => {
		if (!foldStateRef.current.controlled) setInternalFolded(next);
		foldStateRef.current.onFoldedChange?.(next);
	}, []);

	const toggleFold = React.useCallback(
		(start: number): void => {
			const { foldedValue: current, foldedSet: currentSet } = foldStateRef.current;
			commitFolded(currentSet.has(start) ? current.filter((value) => value !== start) : [...current, start].sort((a, b) => a - b));
		},
		[commitFolded],
	);

	/**
	 * A line is hidden when ANY folded region covers it, and that one rule is
	 * what makes nesting work without a tree: folding an outer region swallows
	 * the inner toggles as well, their own folded state survives untouched
	 * underneath, and unfolding the outer one restores exactly what the reader
	 * left behind rather than a flattened block.
	 */
	const renderedLines = React.useMemo((): CodeBlockLine[] => {
		if (!foldable || foldedSet.size === 0) return lines;
		const hidden = new Set<number>();
		for (const start of foldedSet) {
			const region = foldStarts.get(start);
			if (!region) continue;
			for (let n = region.start + 1; n <= region.end; n += 1) {
				hidden.add(n + startLine - 1);
			}
		}
		return lines.filter((line) => !hidden.has(line.number));
	}, [foldable, foldedSet, foldStarts, lines, startLine]);

	const configValue = React.useMemo<CodeBlockConfigValue>(
		() => ({
			language,
			resolvedLanguage,
			showLineNumbers,
			wrap,
			setWrap,
			wrapControlled: wrapProp !== undefined,
			expanded: isExpanded,
			setExpanded,
			collapsible,
			streaming,
			contentId,
			labels,
		}),
		[language, resolvedLanguage, showLineNumbers, wrap, setWrap, wrapProp, isExpanded, setExpanded, collapsible, streaming, contentId, labels],
	);

	const clearSelection = React.useCallback((): void => {
		commitSelection([]);
	}, [commitSelection]);

	const documentValue = React.useMemo<CodeBlockDocumentValue>(
		() => ({
			code: source,
			lines,
			selected: selectedSet,
			selectable,
			toggleLine,
			clearSelection,
			foldable,
			foldRegions,
			folded: foldedSet,
			toggleFold,
			setFolded: commitFolded,
		}),
		[source, lines, selectedSet, selectable, toggleLine, clearSelection, foldable, foldRegions, foldedSet, toggleFold, commitFolded],
	);

	const visibleLines = collapsible && !isExpanded ? maxLines : undefined;

	/* Detected from the element type rather than a `:has()` selector. This repo
	   has measured `:has()` at 85-120ms of style invalidation per DOM mutation,
	   and a streaming block mutates on every chunk, so the primitive uses none. */
	const hasHeader = containsElementType(children, CodeBlockHeader);

	const [lineActions, setLineActions] = React.useState<CodeBlockLineActionsRender | null>(null);
	const [actionsSide, setActionsSide] = React.useState<CodeBlockLineActionsSide>("end");
	const actionsOwnerRef = React.useRef<object | null>(null);
	const actionsRegistry = React.useMemo(
		(): CodeBlockActionsRegistry => ({
			/* Wrapped in a setter callback: a render prop IS a function, so passing
			   it to setState bare would run it as a state updater. Ownership makes
			   a stale unmount a no-op and makes a SECOND live group loud in dev -
			   the registry holds one render prop, so the second silently won. */
			register: (owner, render, side = "end"): void => {
				if (render) {
					if (process.env.NODE_ENV !== "production" && actionsOwnerRef.current && actionsOwnerRef.current !== owner) {
						console.warn("[code-block] Two CodeBlockLineActions are mounted; the block " + "renders ONE action group and the later mount replaces the " + "earlier one.");
					}
					actionsOwnerRef.current = owner;
				} else if (actionsOwnerRef.current !== owner) {
					return;
				} else {
					actionsOwnerRef.current = null;
				}
				setLineActions(() => render);
				setActionsSide(side);
			},
		}),
		[],
	);

	/* One channel between the numbers and the code, shared by the fold toggle
	   and a gutter-side action. Reserved only when something asks for it, so a
	   plain block keeps the gutter it always had. */
	/* Only FOLDING reserves gutter space. A gutter-side action floats over the
	   row's start edge instead of widening anything, so a block with actions is
	   geometrically identical to one without. */
	const gutterChannel = foldable;

	/* Walked rather than registered, so server HTML never carries a doubled
	   surface. Sees through plain wrappers; a consumer component boundary is
	   opaque, which the dev-mode guard in CodeBlockContent reports. */
	const hasContent = containsElementType(children, CodeBlockContent);

	const surfaceProps: CodeBlockSurfaceProps = {
		lines: renderedLines,
		gutterMax: lines.at(-1)?.number ?? startLine,
		foldable,
		gutterChannel,
		actionsSide,
		foldStarts,
		foldedSet,
		onToggleFold: toggleFold,
		expandClearance: collapsible && isExpanded,
		wrap,
		startLine,
		showLineNumbers,
		focusMode,
		selectable,
		selectedSet,
		toggleLine,
		visibleLines,
		streaming,
		label: label ?? (language ? labels.languageCode(language) : labels.code),
		labels,
		contentId,
		actions: lineActions,
		completeAnnouncement,
		builtInSurfaceRendered: !hasContent,
	};

	return (
		<CodeBlockConfigContext.Provider value={configValue}>
			<CodeBlockDocumentContext.Provider value={documentValue}>
				<CodeBlockActionsContext.Provider value={actionsRegistry}>
					<div
						ref={ref}
						data-slot="code-block"
						data-variant={variant}
						data-streaming={streaming ? true : undefined}
						data-has-diff={hasDiff ? true : undefined}
						data-foldable={foldable ? true : undefined}
						data-gutter-channel={gutterChannel ? true : undefined}
						data-has-header={hasHeader ? true : undefined}
						className={cn(
							ROOT_BASE_CLASS,
							ROOT_RADIUS_CLASS,
							ROOT_TOKEN_CLASS,
							variant === "default" ? ROOT_SURFACE_CLASS : undefined,
							variant === "ghost" ? ROOT_GHOST_CLASS : undefined,
							className,
						)}
						{...props}>
						<CodeBlockSurfacePropsContext.Provider value={surfaceProps}>
							{children}
							{!hasContent ? <CodeBlockSurface {...surfaceProps} /> : null}
						</CodeBlockSurfacePropsContext.Provider>
					</div>
				</CodeBlockActionsContext.Provider>
			</CodeBlockDocumentContext.Provider>
		</CodeBlockConfigContext.Provider>
	);
});

export { ansiToLines, markdownCodeProps, markdownFences, parseUnifiedDiff };

export type {
	CodeBlockDiffSpec,
	CodeBlockHighlightOptions,
	CodeBlockLevelSpec,
	CodeBlockLine,
	CodeBlockLineActionContext,
	CodeBlockLineActionsRender,
	CodeBlockLineSpec,
	CodeBlockLineState,
	CodeBlockMarkdownPart,
	CodeBlockPatchFile,
	CodeBlockThemes,
	CodeBlockToken,
	CodeBlockTransformer,
	CodeBlockWordSpec,
	MarkdownCodeProps,
	MarkdownPreProps,
} from "@workspace/ui/components/code-block-highlight";

export {
	CodeBlock,
	CodeBlockCopyButton,
	CodeBlockDownloadButton,
	CodeBlockExpandButton,
	CodeBlockHeader,
	CodeBlockLanguage,
	CodeBlockLineActions,
	CodeBlockTitle,
	CodeBlockContent,
	CodeBlockWrapToggle,
	useCodeBlockConfig,
	useCodeBlockFolding,
	useCodeBlockSelection,
};
