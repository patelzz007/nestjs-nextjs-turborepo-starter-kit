// A file chip (the web kit's `Attachment`): a glyph, the file's name and a
// line of detail ("2.4 MB · PDF"), with an optional remove button. Data-agnostic
// and controlled: the caller formats the detail, opens the file (`onPress`),
// removes it (`onRemove`) and reports an upload in flight (`loading`) or a
// failed one (`invalid`).
//
//   ┌──────────────────────────────────┐
//   │ [▤]  quarterly-report.pdf     ✕  │   glyph tile · name + detail · remove
//   │      2.4 MB · PDF                │
//   └──────────────────────────────────┘

import { cva, type VariantProps } from "class-variance-authority";
import FileIcon from "lucide-react-native/icons/file";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type GestureResponderEvent } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Icon, type LucideIcon } from "./icon";

export const attachmentVariants = cva("flex-row items-center", {
	variants: {
		/** `card`: a chip on the page. `muted`: a chip inside a card or a chat bubble. */
		variant: {
			card: "border border-border bg-card",
			muted: "border border-transparent bg-muted",
		},
		size: {
			md: "min-h-14 gap-1 rounded-xl py-1.5 pl-2",
			sm: "min-h-11 gap-0.5 rounded-lg py-1 pl-1.5",
		},
		state: {
			default: "",
			loading: "",
			disabled: "opacity-60",
			error: "border-destructive",
		},
	},
	defaultVariants: { variant: "card", size: "md", state: "default" },
});

export const attachmentTileVariants = cva("items-center justify-center", {
	variants: {
		variant: {
			card: "bg-muted",
			muted: "bg-card",
		},
		size: {
			md: "size-10 rounded-lg",
			sm: "size-8 rounded-md",
		},
	},
	defaultVariants: { variant: "card", size: "md" },
});

type AttachmentVariantProps = VariantProps<typeof attachmentVariants>;
export type AttachmentVariant = NonNullable<AttachmentVariantProps["variant"]>;
export type AttachmentSize = NonNullable<AttachmentVariantProps["size"]>;

export interface AttachmentLabels {
	/** The remove button's name for a file: "Remove quarterly-report.pdf". */
	readonly remove: (name: string) => string;
}

/** Default copy; generic and overridable. */
export const DEFAULT_ATTACHMENT_LABELS: AttachmentLabels = {
	remove: (name: string): string => `Remove ${name}`,
};

export interface AttachmentProps {
	/** The file's name. */
	readonly name: string;
	/** A line of detail formatted by the caller ("2.4 MB · PDF", "Uploading… 40%", "Upload failed"). */
	readonly description?: string | undefined;
	/** The file type's glyph; a generic file by default. */
	readonly icon?: LucideIcon | undefined;
	/** Opens the file; without it the chip is not pressable. */
	readonly onPress?: ((event: GestureResponderEvent) => void) | undefined;
	/** Shows a remove button. */
	readonly onRemove?: (() => void) | undefined;
	/** The file is uploading: a spinner in the tile, and opening is blocked (removing still cancels it). */
	readonly loading?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** The caller's outcome for the file: the upload failed or the file was rejected. */
	readonly invalid?: boolean | undefined;
	readonly labels?: AttachmentLabels | undefined;
	readonly variant?: AttachmentVariant | undefined;
	readonly size?: AttachmentSize | undefined;
	/** What opening does, for screen readers ("Opens the file"). */
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the chip, merged last (layout: `self-start`, `w-full`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Attachment = React.memo(
	React.forwardRef<View, AttachmentProps>(function Attachment(
		{
			name,
			description,
			icon = FileIcon,
			onPress,
			onRemove,
			loading = false,
			disabled = false,
			invalid = false,
			labels = DEFAULT_ATTACHMENT_LABELS,
			variant = "card",
			size = "md",
			accessibilityHint,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const accessibilityLabel = description === undefined ? name : `${name}, ${description}`;
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading }), [isInactive, loading]);
		const removeAccessibilityState = React.useMemo(() => ({ disabled }), [disabled]);

		const content = (
			<>
				<View className={attachmentTileVariants({ variant, size })}>
					{loading ? (
						<ActivityIndicator size="small" colorClassName="accent-muted-foreground" />
					) : (
						<Icon icon={icon} size={size === "md" ? "md" : "sm"} colorClassName={state === "error" ? "accent-destructive-foreground" : "accent-muted-foreground"} />
					)}
				</View>
				<View className="shrink">
					<Text numberOfLines={1} className={cn("font-sans-medium text-foreground", size === "md" ? "text-sm" : "text-xs")}>
						{name}
					</Text>
					{description === undefined ? null : (
						<Text numberOfLines={1} className={cn("font-sans text-xs", state === "error" ? "text-destructive-foreground" : "text-muted-foreground")}>
							{description}
						</Text>
					)}
				</View>
			</>
		);

		return (
			<View ref={ref} testID={testID} className={cn(attachmentVariants({ variant, size, state }), onRemove === undefined ? "pr-3" : "pr-0", className)}>
				{onPress === undefined ? (
					<View accessible accessibilityLabel={accessibilityLabel} accessibilityState={accessibilityState} className="flex-1 flex-row items-center gap-2.5">
						{content}
					</View>
				) : (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={accessibilityLabel}
						accessibilityHint={accessibilityHint}
						accessibilityState={accessibilityState}
						disabled={isInactive}
						onPress={onPress}
						className="min-h-11 flex-1 flex-row items-center gap-2.5 active:opacity-70">
						{content}
					</Pressable>
				)}
				{onRemove === undefined ? null : (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={labels.remove(name)}
						accessibilityState={removeAccessibilityState}
						disabled={disabled}
						onPress={onRemove}
						className="size-11 items-center justify-center active:opacity-60">
						<Icon icon={XIcon} size="sm" colorClassName="accent-muted-foreground" />
					</Pressable>
				)}
			</View>
		);
	}),
);
