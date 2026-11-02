// A block of code (the web kit's `CodeBlock`): monospaced, never wrapped, and
// scrolled sideways when a line is wider than the screen. An optional header
// shows the language and a caption, and a copy button when the caller passes
// `onCopy`. The kit never touches the clipboard: the caller copies (expo-clipboard
// in the app) and says so through `copied`, which swaps the glyph and the name.
// `showLineNumbers` adds a gutter that stays put while the code scrolls; the
// numbers are never selected or copied with the code, nor read out.
//
//   ┌ TYPESCRIPT · auth.ts ───────── ⧉ ┐   header: language, caption, copy
//   │ 1 │ const token = await signIn(…→│   gutter (optional) · code: scrolls sideways
//   └──────────────────────────────────┘

import { cva, type VariantProps } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import CopyIcon from "lucide-react-native/icons/copy";
import * as React from "react";
import { Pressable, ScrollView, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon } from "./icon";

export const codeBlockVariants = cva("w-full overflow-hidden rounded-lg border border-border", {
	variants: {
		/** `muted`: a block inside running text. `card`: a block that stands on its own surface. */
		variant: {
			muted: "bg-muted",
			card: "bg-card",
		},
	},
	defaultVariants: { variant: "muted" },
});

export const codeBlockTextVariants = cva("font-mono text-foreground", {
	variants: {
		size: {
			sm: "px-3 py-2 text-xs",
			md: "px-4 py-3 text-sm",
		},
	},
	defaultVariants: { size: "md" },
});

/** The gutter beside the code: the same type and padding, so each number sits on its line. */
export const codeBlockGutterVariants = cva("border-r border-border text-right font-mono text-muted-foreground", {
	variants: {
		size: {
			sm: "py-2 pr-2 pl-3 text-xs",
			md: "py-3 pr-3 pl-4 text-sm",
		},
	},
	defaultVariants: { size: "md" },
});

/** The gutter's text: one number per line of `code`, counting from 1 ("1\n2\n3" for three lines). */
export function codeLineNumbers(code: string): string {
	return code
		.split("\n")
		.map((_line, index): string => String(index + 1))
		.join("\n");
}

type CodeBlockVariantProps = VariantProps<typeof codeBlockVariants>;
export type CodeBlockVariant = NonNullable<CodeBlockVariantProps["variant"]>;
export type CodeBlockSize = NonNullable<VariantProps<typeof codeBlockTextVariants>["size"]>;

/** The copy button's default names; generic and overridable. */
export const DEFAULT_CODE_BLOCK_LABELS: CodeBlockLabels = { copy: "Copy code", copied: "Copied" };

export interface CodeBlockLabels {
	/** The copy button's name before copying. */
	readonly copy: string;
	/** Its name once the caller reports the code copied. */
	readonly copied: string;
}

export interface CodeBlockProps {
	readonly code: string;
	/** The language's name, shown in the header ("TypeScript"). */
	readonly language?: string | undefined;
	/** A line on what the code is ("auth.ts"), shown in the header. */
	readonly caption?: string | undefined;
	/** Shows a copy button; the caller copies `code` to the clipboard. */
	readonly onCopy?: (() => void) | undefined;
	/** The caller copied the code: the button shows a check and its `copied` name. */
	readonly copied?: boolean | undefined;
	readonly labels?: CodeBlockLabels | undefined;
	/** Numbers each line in a gutter beside the code (the web kit's `showLineNumbers`). */
	readonly showLineNumbers?: boolean | undefined;
	readonly variant?: CodeBlockVariant | undefined;
	readonly size?: CodeBlockSize | undefined;
	/** Extra classes for the container, merged last (layout: `mt-2`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const CodeBlock = React.memo(
	React.forwardRef<ViewInstance, CodeBlockProps>(function CodeBlock(
		{ code, language, caption, onCopy, copied = false, labels = DEFAULT_CODE_BLOCK_LABELS, showLineNumbers = false, variant = "muted", size = "md", className, testID },
		ref,
	): React.JSX.Element {
		const hasHeader = language !== undefined || caption !== undefined || onCopy !== undefined;
		return (
			<View ref={ref} testID={testID} className={cn(codeBlockVariants({ variant }), className)}>
				{hasHeader ? (
					<View className="min-h-11 flex-row items-center gap-2 border-b border-border pl-4">
						<View className="flex-1 flex-row items-center gap-2">
							{language === undefined ? null : <Text className="font-mono text-xs text-muted-foreground uppercase">{language}</Text>}
							{caption === undefined ? null : (
								<Text numberOfLines={1} className="shrink font-sans text-xs text-muted-foreground">
									{caption}
								</Text>
							)}
						</View>
						{onCopy === undefined ? null : <CodeBlockCopyButton copied={copied} labels={labels} onCopy={onCopy} />}
					</View>
				) : null}
				<View className="flex-row">
					{showLineNumbers ? (
						<Text
							className={codeBlockGutterVariants({ size })}
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							testID={testID === undefined ? undefined : `${testID}-line-numbers`}>
							{codeLineNumbers(code)}
						</Text>
					) : null}
					<ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1" testID={testID === undefined ? undefined : `${testID}-scroll`}>
						<Text selectable className={codeBlockTextVariants({ size })}>
							{code}
						</Text>
					</ScrollView>
				</View>
			</View>
		);
	}),
);

interface CodeBlockCopyButtonProps {
	readonly copied: boolean;
	readonly labels: CodeBlockLabels;
	readonly onCopy: () => void;
}

const CodeBlockCopyButton = React.memo(function CodeBlockCopyButton({ copied, labels, onCopy }: CodeBlockCopyButtonProps): React.JSX.Element {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={copied ? labels.copied : labels.copy}
			onPress={onCopy}
			className="size-11 items-center justify-center active:opacity-60">
			<Icon icon={copied ? CheckIcon : CopyIcon} size="sm" colorClassName={copied ? "accent-success" : "accent-muted-foreground"} />
		</Pressable>
	);
});
