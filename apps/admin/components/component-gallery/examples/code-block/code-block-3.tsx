"use client";

import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { CodeBlock, CodeBlockContent, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockTitle } from "@workspace/ui/components/code-block";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";

/*
 * The sample deliberately omits its import statements: the registry verifier
 * scans raw file text for import shapes and would read them as real package
 * dependencies of the example, which then fails `registry:verify`.
 */
const TARGET = `export async function POST(request: Request) {
  const { messages } = await request.json()

  const result = streamText({
    model: openai("gpt-5"),
    system: "You are a concise assistant.",
    messages,
    temperature: 0.2,
    maxOutputTokens: 1024,
  })

  result.usage.then((usage) => {
    metrics.record("chat.tokens", usage.totalTokens)
  })

  return result.toUIMessageStreamResponse()
}`;

/** Characters the demo "model" emits per chunk. */
const CHARS_PER_CHUNK = 3;
/** Delay between streamed chunks. */
const CHUNK_DELAY_MS = 24;

export function CodeBlock3Example(): React.JSX.Element {
	const [length, setLength] = React.useState(0);

	React.useEffect((): (() => void) | undefined => {
		if (length >= TARGET.length) {
			return undefined;
		}
		const id = window.setTimeout((): void => {
			setLength((value: number): number => value + CHARS_PER_CHUNK);
		}, CHUNK_DELAY_MS);
		return (): void => {
			window.clearTimeout(id);
		};
	}, [length]);

	const handleReplay = React.useCallback((): void => {
		setLength(0);
	}, []);

	const done = length >= TARGET.length;

	return (
		<div className="flex w-full max-w-2xl flex-col gap-3">
			<CodeBlock code={TARGET.slice(0, length)} language="typescript" showLineNumbers streaming={!done}>
				<CodeBlockHeader>
					<CodeBlockTitle>app/api/chat/route.ts</CodeBlockTitle>
					<CodeBlockLanguage />
					<div className="ml-auto flex items-center gap-1.5">
						<Badge variant={done ? "success-light" : "info-light"}>{done ? "Complete" : "Generating"}</Badge>
						<CodeBlockCopyButton />
					</div>
				</CodeBlockHeader>

				{/* The consumer's ScrollArea owns the scroll, and stick-to-bottom
				    follows it: the primitive resolves the nearest scrolling ancestor
				    per chunk, so the caret stays in view exactly as it does with the
				    built-in viewport. */}
				<ScrollArea className="rounded-[inherit] **:data-[slot=scroll-area-viewport]:max-h-60">
					<CodeBlockContent />
					<ScrollBar orientation="horizontal" />
				</ScrollArea>
			</CodeBlock>

			<Button variant="outline" size="sm" className="self-start" onClick={handleReplay}>
				Replay stream
			</Button>
		</div>
	);
}
