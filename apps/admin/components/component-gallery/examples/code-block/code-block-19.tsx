import type * as React from "react";

import { CodeBlock, CodeBlockContent, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle, type CodeBlockThemes } from "@workspace/ui/components/code-block";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";
import { cn } from "@workspace/ui/lib/core/utils";

const CODE = `export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const toggle = () => setTheme((value) => (value === "light" ? "dark" : "light"))
  return { theme, toggle }
}`;

/** Shiki's variable-emitting theme, for both modes: the palette below decides the colours. */
const CSS_VARIABLE_THEMES: CodeBlockThemes = { light: "css-variables", dark: "css-variables" };

/*
 * The "css-variables" theme emits var(--code-token-*) references instead of
 * hex colors, so the palette below IS the syntax theme. Every entry points at
 * one of the kit's tone tokens, which already resolve per mode, so the
 * highlighting follows the design system in light and dark alike.
 */
const PALETTE_CLASS = cn(
	"[--code-token-keyword:var(--tone-red)]",
	"[--code-token-function:var(--tone-violet)]",
	"[--code-token-string:var(--tone-green)]",
	"[--code-token-string-expression:var(--tone-green)]",
	"[--code-token-constant:var(--tone-blue)]",
	"[--code-token-parameter:var(--tone-orange)]",
	"[--code-token-comment:var(--muted-foreground)]",
	"[--code-token-punctuation:var(--foreground)]",
	"[--code-foreground:var(--foreground)]",
);

export function CodeBlock19Example(): React.JSX.Element {
	return (
		<CodeBlock code={CODE} language="typescript" showLineNumbers themes={CSS_VARIABLE_THEMES} className={cn("w-full max-w-2xl", PALETTE_CLASS)}>
			<CodeBlockHeader>
				<CodeBlockTitle>use-theme.ts</CodeBlockTitle>
				<div className="ml-auto flex items-center gap-1.5">
					<span className="text-xs text-muted-foreground">Colors from design tokens</span>
					<CodeBlockCopyButton />
				</div>
			</CodeBlockHeader>

			{/* The ScrollArea composes INSIDE the block, so the block's own border
			    and per-style radius stay the container, the header above never
			    scrolls, and `max-h` means the area grows to the content instead of
			    stretching past a short file. */}
			<ScrollArea className="rounded-[inherit] **:data-[slot=scroll-area-viewport]:max-h-72">
				<CodeBlockContent />
				<ScrollBar orientation="horizontal" />
			</ScrollArea>
		</CodeBlock>
	);
}
