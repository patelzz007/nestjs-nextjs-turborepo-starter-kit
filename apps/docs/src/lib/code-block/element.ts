import {
	CodeBlock,
	CodeBlockCopyButton,
	CodeBlockExpandButton,
	CodeBlockHeader,
	CodeBlockLanguage,
	CodeBlockTitle,
	CodeBlockWrapToggle,
	DEFAULT_CODE_BLOCK_LABELS,
} from "@workspace/ui/components/display/code-block";
import { createElement, type ReactElement } from "react";

import type { DocsCodeBlockProps } from "./props";

/**
 * Overrides the CodeBlock's own `--code-block-font-size` token (13px) with the
 * docs' code size, so fenced code matches inline code in the prose around it.
 */
export const CODE_BLOCK_TYPE_CLASS = "[--code-block-font-size:var(--type-code-block-size)]";

/**
 * The docs' composition of the `@workspace/ui` CodeBlock (the ReUI port):
 * header with title · language · wrap · copy, line numbers, folding, and
 * "Show more" for long blocks. Used for BOTH the build-time render and the
 * browser hydration, so the two trees are identical by construction.
 */
export function docsCodeBlockElement(props: DocsCodeBlockProps): ReactElement {
	const header = createElement(
		CodeBlockHeader,
		null,
		props.title === null ? null : createElement(CodeBlockTitle, null, props.title),
		props.language.length === 0 ? null : createElement(CodeBlockLanguage, null, props.language),
		createElement("div", { className: "ms-auto flex items-center gap-1" }, createElement(CodeBlockWrapToggle, null), createElement(CodeBlockCopyButton, null)),
	);
	return createElement(
		CodeBlock,
		{
			lines: props.lines,
			language: props.language,
			showLineNumbers: props.showLineNumbers,
			foldable: props.foldable,
			labels: DEFAULT_CODE_BLOCK_LABELS,
			label: props.title ?? props.language,
			// The docs' type scale sets the code size (`--type-code-block-size` in src/styles/global.css).
			className: CODE_BLOCK_TYPE_CLASS,
			// Only long blocks collapse; the prop is omitted (not `undefined`) otherwise.
			...(props.maxLines === null ? {} : { maxLines: props.maxLines }),
		},
		header,
		props.maxLines === null ? null : createElement(CodeBlockExpandButton, null),
	);
}
