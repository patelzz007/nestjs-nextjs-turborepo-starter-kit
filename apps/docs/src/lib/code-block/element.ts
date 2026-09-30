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
			// Only long blocks collapse; the prop is omitted (not `undefined`) otherwise.
			...(props.maxLines === null ? {} : { maxLines: props.maxLines }),
		},
		header,
		props.maxLines === null ? null : createElement(CodeBlockExpandButton, null),
	);
}
