"use client";

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { CodeBlock, CodeBlockCopyButton, markdownFences, type CodeBlockMarkdownPart } from "@workspace/ui/components/code-block";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

const REPLY = `Use the streaming helper, then render it:

\`\`\`tsx
const { messages } = useChat({ api: "/api/chat" })
\`\`\`

That keeps the transcript in sync.`;

/** Characters the demo "model" emits per chunk. */
const CHARS_PER_CHUNK = 4;
/** Delay between streamed chunks. */
const CHUNK_DELAY_MS = 30;

const ASKER_AVATAR_SRC = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80";

interface KeyedPart {
	readonly key: string;
	readonly part: CodeBlockMarkdownPart;
}

/*
 * A part keeps its place while the message streams (prose grows, a fence
 * opens then closes), so "the nth code part" is a stable identity where the
 * array position of a mixed list would not be.
 */
function keyParts(parts: readonly CodeBlockMarkdownPart[]): readonly KeyedPart[] {
	const seen: Record<CodeBlockMarkdownPart["type"], number> = { text: 0, code: 0 };
	return parts.map((part: CodeBlockMarkdownPart): KeyedPart => {
		seen[part.type] += 1;
		return { key: `${part.type}-${String(seen[part.type])}`, part };
	});
}

/*
 * `markdownFences` flags a fence whose closing delimiter has not arrived as
 * `open`, which is what lets the transcript render the partial block mid
 * stream instead of dropping it until the closer lands.
 */
export function CodeBlock4Example(): React.JSX.Element {
	const [length, setLength] = React.useState(0);

	React.useEffect((): (() => void) | undefined => {
		if (length >= REPLY.length) {
			return undefined;
		}
		const id = window.setTimeout((): void => {
			setLength((value: number): number => value + CHARS_PER_CHUNK);
		}, CHUNK_DELAY_MS);
		return (): void => {
			window.clearTimeout(id);
		};
	}, [length]);

	const streaming = length < REPLY.length;
	const parts = React.useMemo((): readonly KeyedPart[] => keyParts(markdownFences(REPLY.slice(0, length))), [length]);

	return (
		<Frame dense className="w-full max-w-2xl">
			<FrameHeader>
				<FrameTitle>Assistant</FrameTitle>
				<FrameDescription>Generated responses may contain mistakes.</FrameDescription>
			</FrameHeader>

			<FramePanel className="flex flex-col gap-4">
				<div className="flex gap-3">
					<Avatar className="size-7 shrink-0 rounded-full">
						<AvatarImage src={ASKER_AVATAR_SRC} alt="Mira Stone" />
						<AvatarFallback className="text-badge-sm font-medium">MS</AvatarFallback>
					</Avatar>
					<p className="pt-1 text-sm">How do I stream chat messages?</p>
				</div>

				<div className="flex gap-3">
					<Avatar className="size-7 shrink-0 rounded-full">
						<AvatarFallback className="text-badge-sm bg-muted font-medium text-muted-foreground">AI</AvatarFallback>
					</Avatar>
					<div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
						{parts.map(({ key, part }: KeyedPart): React.JSX.Element =>
							part.type === "text" ? (
								<p key={key} className="text-sm whitespace-pre-wrap">
									{part.content}
								</p>
							) : (
								<CodeBlock key={key} code={part.content} language={part.language} streaming={streaming ? part.open : false}>
									<CodeBlockCopyButton />
								</CodeBlock>
							),
						)}
					</div>
				</div>
			</FramePanel>
		</Frame>
	);
}
