// A file chip or card (the web kit's `Attachment`): a glyph or an image preview, the file's name and a line of
// detail ("2.4 MB · PDF"), actions (download, retry, cancel) and an optional remove button. Data-agnostic and
// controlled: the caller formats the detail, opens the file (`onPress`), runs the actions and says where its upload
// is (`state`: queued, uploading, processing, failed or done — the web's states; `loading` and `invalid` are the
// older shorthands for uploading and failed).
//
//   ┌──────────────────────────────────────┐
//   │ [▤]  quarterly-report.pdf   [⤓]  ✕  │   media · name + detail · actions · remove
//   │      2.4 MB · PDF                    │
//   └──────────────────────────────────────┘
//
// `orientation="vertical"` stacks the media above the name: a card for an image strip.
import { cva, type VariantProps } from "class-variance-authority";
import FileIcon from "lucide-react-native/icons/file";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { ActivityIndicator, type GestureResponderEvent, Image, Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Icon, type LucideIcon } from "./icon";

/** Where a file's upload is: queued (not started), uploading, processing (a scan, a conversion), failed, or done. */
export type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done";

export const attachmentVariants = cva("", {
	variants: {
		/** `card`: a chip on the page. `muted`: a chip inside a card or a chat bubble. */
		variant: {
			card: "border border-border bg-card",
			muted: "border border-transparent bg-muted",
		},
		size: {
			md: "min-h-14 gap-1 rounded-xl py-1.5 pl-2",
			sm: "min-h-11 gap-0.5 rounded-lg py-1 pl-1.5",
			xs: "min-h-9 gap-0.5 rounded-lg py-0.5 pl-1",
		},
		orientation: {
			horizontal: "flex-row items-center",
			vertical: "w-28 gap-1.5 p-1.5",
		},
		state: {
			default: "",
			loading: "",
			disabled: "opacity-60",
			error: "border-destructive",
		},
		/** A queued file waits behind a dashed border, as on the web. */
		queued: { true: "border-dashed", false: "" },
		pressed: { true: "border-primary bg-primary/5", false: "" },
	},
	defaultVariants: { variant: "card", size: "md", orientation: "horizontal", state: "default", queued: false, pressed: false },
});

export const attachmentTileVariants = cva("items-center justify-center overflow-hidden", {
	variants: {
		variant: {
			card: "bg-muted",
			muted: "bg-card",
		},
		size: {
			md: "size-10 rounded-lg",
			sm: "size-8 rounded-md",
			xs: "size-7 rounded-md",
		},
		vertical: { true: "aspect-square h-auto w-full rounded-lg", false: "" },
		failed: { true: "bg-destructive/10", false: "" },
	},
	defaultVariants: { variant: "card", size: "md", vertical: false, failed: false },
});

type AttachmentVariantProps = VariantProps<typeof attachmentVariants>;
export type AttachmentVariant = NonNullable<AttachmentVariantProps["variant"]>;
export type AttachmentSize = NonNullable<AttachmentVariantProps["size"]>;
export type AttachmentOrientation = NonNullable<AttachmentVariantProps["orientation"]>;

export interface AttachmentLabels {
	/** The remove button's name for a file: "Remove quarterly-report.pdf". */
	readonly remove: (name: string) => string;
}

/** Default copy; generic and overridable. */
export const DEFAULT_ATTACHMENT_LABELS: AttachmentLabels = {
	remove: (name: string): string => `Remove ${name}`,
};

/** A button at the chip's end: download, retry, cancel. */
export interface AttachmentAction {
	readonly key: string;
	/** Its accessible name ("Download quarterly-report.pdf"). */
	readonly label: string;
	readonly icon: LucideIcon;
	readonly onPress: () => void;
}

export interface AttachmentProps {
	/** The file's name. */
	readonly name: string;
	/** A line of detail formatted by the caller ("2.4 MB · PDF", "Uploading… 40%", "Upload failed"). */
	readonly description?: string | undefined;
	/** The file type's glyph; a generic file by default. */
	readonly icon?: LucideIcon | undefined;
	/** A preview in place of the glyph (an image's thumbnail). */
	readonly imageUri?: string | undefined;
	/** Opens the file; without it the chip is not pressable. */
	readonly onPress?: ((event: GestureResponderEvent) => void) | undefined;
	/** Shows a remove button. */
	readonly onRemove?: (() => void) | undefined;
	/** Buttons before the remove button. */
	readonly actions?: readonly AttachmentAction[] | undefined;
	/** Where the file's upload is. Default `done` (or what `loading` / `invalid` say). */
	readonly state?: AttachmentState | undefined;
	/** The file is uploading (`state="uploading"`): a spinner in the tile, and opening is blocked. */
	readonly loading?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** The upload failed or the file was rejected (`state="error"`). */
	readonly invalid?: boolean | undefined;
	/** The chip is the chosen one (an image picked in a strip). */
	readonly pressed?: boolean | undefined;
	readonly labels?: AttachmentLabels | undefined;
	readonly variant?: AttachmentVariant | undefined;
	readonly size?: AttachmentSize | undefined;
	readonly orientation?: AttachmentOrientation | undefined;
	/** What opening does, for screen readers ("Opens the file"). */
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the chip, merged last (layout: `self-start`, `w-full`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const ICON_SIZES: Readonly<Record<AttachmentSize, "md" | "sm" | "xs">> = { md: "md", sm: "sm", xs: "xs" };

/** One trailing action button. */
function ActionButton({ action, disabled }: { readonly action: AttachmentAction; readonly disabled: boolean }): React.JSX.Element {
	const accessibilityState = React.useMemo(() => ({ disabled }), [disabled]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={action.label}
			accessibilityState={accessibilityState}
			disabled={disabled}
			onPress={action.onPress}
			className="size-11 items-center justify-center active:opacity-60">
			<Icon icon={action.icon} size="sm" colorClassName="accent-icon" />
		</Pressable>
	);
}

export const Attachment = React.memo(
	React.forwardRef<ViewInstance, AttachmentProps>(function Attachment(
		{
			name,
			description,
			icon = FileIcon,
			imageUri,
			onPress,
			onRemove,
			actions = [],
			state: upload,
			loading = false,
			disabled = false,
			invalid = false,
			pressed = false,
			labels = DEFAULT_ATTACHMENT_LABELS,
			variant = "card",
			size = "md",
			orientation = "horizontal",
			accessibilityHint,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const phase: AttachmentState = upload ?? (loading ? "uploading" : invalid ? "error" : "done");
		const state = resolveControlState({ disabled, loading: phase === "uploading", invalid: phase === "error" });
		const isInactive = isInactiveState(state);
		const vertical = orientation === "vertical";
		const accessibilityLabel = description === undefined ? name : `${name}, ${description}`;
		const busy = phase === "uploading" || phase === "processing";
		const accessibilityState = { disabled: isInactive, busy, selected: pressed };
		const removeAccessibilityState = React.useMemo(() => ({ disabled }), [disabled]);
		const source = React.useMemo(() => (imageUri === undefined ? null : { uri: imageUri }), [imageUri]);

		const media =
			phase === "uploading" ? (
				<ActivityIndicator size="small" colorClassName="accent-muted-foreground" />
			) : source === null ? (
				<Icon icon={icon} size={vertical ? "lg" : ICON_SIZES[size]} colorClassName={phase === "error" ? "accent-destructive-foreground" : "accent-muted-foreground"} />
			) : (
				<Image
					source={source}
					accessibilityLabel={name}
					accessibilityIgnoresInvertColors
					accessibilityElementsHidden
					importantForAccessibility="no"
					resizeMode="cover"
					className={cn("size-full", phase === "processing" ? "opacity-50" : "")}
				/>
			);

		const content = (
			<>
				<View className={attachmentTileVariants({ variant, size, vertical, failed: phase === "error" })}>{media}</View>
				<View className={vertical ? "gap-0.5" : "shrink"}>
					<Text numberOfLines={1} className={cn("font-sans-medium text-foreground", size === "md" ? "text-body" : "text-caption")}>
						{name}
					</Text>
					{description === undefined ? null : (
						<Text numberOfLines={1} className={cn("text-caption font-sans", phase === "error" ? "text-destructive-foreground" : "text-muted-foreground")}>
							{description}
						</Text>
					)}
				</View>
			</>
		);

		const body =
			onPress === undefined ? (
				<View
					accessible
					accessibilityLabel={accessibilityLabel}
					accessibilityState={accessibilityState}
					className={vertical ? "gap-1.5" : "flex-1 flex-row items-center gap-2.5"}>
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
					className={vertical ? "gap-1.5 active:opacity-70" : "min-h-11 flex-1 flex-row items-center gap-2.5 active:opacity-70"}>
					{content}
				</Pressable>
			);
		const trailing =
			actions.length === 0 && onRemove === undefined ? null : (
				<View className={vertical ? "flex-row justify-end" : "flex-row items-center"}>
					{actions.map((action: AttachmentAction): React.JSX.Element => (
						<ActionButton key={action.key} action={action} disabled={disabled} />
					))}
					{onRemove === undefined ? null : (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={labels.remove(name)}
							accessibilityState={removeAccessibilityState}
							disabled={disabled}
							onPress={onRemove}
							className="size-11 items-center justify-center active:opacity-60">
							<Icon icon={XIcon} size="sm" colorClassName="accent-icon" />
						</Pressable>
					)}
				</View>
			);

		return (
			<View
				ref={ref}
				testID={testID}
				className={cn(
					attachmentVariants({ variant, size, orientation, state, queued: phase === "idle", pressed }),
					vertical || trailing !== null ? "pr-0" : "pr-3",
					vertical ? "pr-1.5" : "",
					className,
				)}>
				{body}
				{trailing}
			</View>
		);
	}),
);
