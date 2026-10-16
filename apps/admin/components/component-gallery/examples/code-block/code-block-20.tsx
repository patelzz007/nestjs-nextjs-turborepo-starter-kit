import type * as React from "react";

import {
	CodeBlock,
	CodeBlockCopyButton,
	CodeBlockHeader,
	CodeBlockTitle,
	type CodeBlockDiffSpec,
	type CodeBlockLevelSpec,
	type CodeBlockLineSpec,
	type CodeBlockWordSpec,
} from "@workspace/ui/components/code-block";

const CODE = `export function Hero({ headline, snippet }: HeroProps) {
  const seats = useSeatCount()

  return (
    <section className="dark bg-background py-24">
      <h1 className="text-4xl font-semibold">{headline}</h1>
      <img src={cover} />
      <pre className="overflow-x-auto">{snippet}</pre>
      <CodeBlock code={snippet} language="tsx" showLineNumbers />
      <a onClick={goToPricing}>Start free</a>
      <p>{seats} seats claimed</p>
    </section>
  )
}`;

/* Every decoration the block has, so the forced-dark palette shows them all. */
const HIGHLIGHTED_LINES: CodeBlockLineSpec = [5];
const HIGHLIGHTED_WORDS: CodeBlockWordSpec[] = ["useSeatCount"];
const DIFF: CodeBlockDiffSpec = { removed: [8], added: [9] };
const LINE_LEVELS: CodeBlockLevelSpec = { error: [10], warning: [7], info: [11] };

/*
 * A block that stays dark in both site themes, the way marketing pages and
 * landing heroes usually want code to read. The `dark` class on the wrapper
 * re-scopes every semantic token inside it, so the primitive needs nothing:
 * the highlight, both diff tints, the three diagnostic levels and the word
 * mark all resolve against the dark palette here instead of the page's.
 */
export function CodeBlock20Example(): React.JSX.Element {
	return (
		<div className="dark w-full max-w-2xl">
			<CodeBlock code={CODE} language="tsx" showLineNumbers highlightedLines={HIGHLIGHTED_LINES} highlightedWords={HIGHLIGHTED_WORDS} diff={DIFF} lineLevels={LINE_LEVELS}>
				<CodeBlockHeader>
					{/* Window controls, drawn with the tone tokens. */}
					<span aria-hidden="true" className="flex shrink-0 items-center gap-1.5">
						<span className="size-2.5 rounded-full bg-tone-red" />
						<span className="size-2.5 rounded-full bg-tone-yellow" />
						<span className="size-2.5 rounded-full bg-tone-green" />
					</span>
					<CodeBlockTitle className="ml-1">hero.tsx</CodeBlockTitle>
					<CodeBlockCopyButton className="ml-auto" />
				</CodeBlockHeader>
			</CodeBlock>
		</div>
	);
}
