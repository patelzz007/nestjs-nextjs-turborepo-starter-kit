// A centred modal card over a dimmed scrim: a question, a short form, a
// detail that needs the person's full attention. The phone form of the web
// kit's Dialog (packages/ui/src/components/dialog.tsx), with the same parts —
// DialogHeader, DialogTitle, DialogDescription, DialogBody (a scrolling
// middle), DialogFooter — composed as children. `showCloseButton` adds a
// corner close button; `size="full"` takes nearly the whole screen.
//
// Controlled: the caller owns `open` and hears `onOpenChange(false)` when the
// dialog asks to close — a tap on the scrim (unless `dismissible` is off) or
// the Android back button. While `loading`, both are ignored: the work in
// flight decides when the dialog closes.
//
// Focus stays inside: the dialog is a Modal (a window of its own on Android)
// and its card is `accessibilityViewIsModal` (iOS), so a screen reader never
// wanders to the screen behind it (rules/07, "Focus trapping"). It fades in
// and out, and simply appears and disappears under Reduce Motion.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import XIcon from "lucide-react-native/icons/x";
import { Modal, Pressable, ScrollView, type ScrollViewInstance, Text, type TextInstance, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { FieldSurfaceProvider } from "../lib/field-surface";
import { resolveControlState } from "../lib/control-state";
import { useReduceMotion } from "../lib/use-reduce-motion";
import { Icon } from "./icon";

export const dialogVariants = cva("w-full gap-4 rounded-3xl border bg-popover p-6 shadow-lg", {
	variants: {
		/** `destructive`: the dialog is about an irreversible action: its confirm button says so in red, its edge stays quiet. */
		variant: {
			default: "border-border",
			destructive: "",
		},
		size: {
			sm: "max-w-sm",
			md: "max-w-md",
			lg: "max-w-lg",
			/** Nearly the whole screen: a long form or a document, with its own scrolling body. */
			full: "h-11/12 max-w-none p-0",
		},
		state: {
			default: "",
			loading: "",
			disabled: "opacity-60",
			error: "border-destructive",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

type DialogVariantProps = VariantProps<typeof dialogVariants>;
export type DialogVariant = NonNullable<DialogVariantProps["variant"]>;
export type DialogSize = NonNullable<DialogVariantProps["size"]>;

/** Which role a screen reader announces the card with: a plain dialog, or an alert that needs a decision. */
export type DialogRole = "dialog" | "alertdialog";

/** The scrim's generic name for touch-exploration users (it is hidden from screen readers otherwise). */
const DEFAULT_CLOSE_LABEL = "Close";

export interface DialogProps {
	readonly open: boolean;
	/** The dialog asks to open or close (`false`: scrim tap or Android back). */
	readonly onOpenChange: (open: boolean) => void;
	readonly children: React.ReactNode;
	readonly variant?: DialogVariant;
	readonly size?: DialogSize;
	/** Work started from the dialog is in flight: it announces busy and ignores close requests. */
	readonly loading?: boolean;
	/** The caller's outcome for the dialog's form or action was a failure. */
	readonly invalid?: boolean;
	/** A tap on the scrim closes the dialog (default `true`; an alert dialog turns it off). */
	readonly dismissible?: boolean;
	readonly role?: DialogRole;
	/** The scrim's accessible name (default "Close"). */
	readonly closeLabel?: string;
	/** Names the dialog for screen readers when its title alone is not enough. */
	readonly accessibilityLabel?: string | undefined;
	/** A close button in the card's top corner. Default `false`: the footer's actions close it. */
	readonly showCloseButton?: boolean | undefined;
	/** Extra classes for the corner close button (a round chip past the edge), merged last. */
	readonly closeButtonClassName?: string | undefined;
	/** Extra classes for the card, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The corner close button's extra touch area around its 32 pt circle, to reach 44 pt (rules/04). */
const CLOSE_HIT_SLOP = 6;

export const Dialog = React.memo(
	React.forwardRef<ViewInstance, DialogProps>(function Dialog(
		{
			open,
			onOpenChange,
			children,
			variant = "default",
			size = "md",
			loading = false,
			invalid = false,
			dismissible = true,
			role = "dialog",
			closeLabel = DEFAULT_CLOSE_LABEL,
			accessibilityLabel,
			showCloseButton = false,
			closeButtonClassName,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const reduceMotion = useReduceMotion();
		const state = resolveControlState({ loading, invalid });
		const accessibilityState = React.useMemo(() => ({ busy: loading }), [loading]);

		const requestClose = React.useCallback((): void => {
			if (!loading) {
				onOpenChange(false);
			}
		}, [loading, onOpenChange]);
		const pressScrim = React.useCallback((): void => {
			if (dismissible) {
				requestClose();
			}
		}, [dismissible, requestClose]);

		return (
			<Modal visible={open} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={requestClose} statusBarTranslucent>
				<View className="flex-1 items-center justify-center px-6">
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={closeLabel}
						onPress={pressScrim}
						testID={testID === undefined ? undefined : `${testID}-scrim`}
						className="absolute inset-0 bg-scrim opacity-50"
					/>
					<View
						ref={ref}
						accessibilityViewIsModal
						role={role}
						accessibilityLabel={accessibilityLabel}
						accessibilityState={accessibilityState}
						testID={testID}
						className={cn(dialogVariants({ variant, size, state }), className)}>
						{/* Fields in a dialog take its popover fill. */}
						<FieldSurfaceProvider surface="popover">{children}</FieldSurfaceProvider>
						{showCloseButton ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={closeLabel}
								disabled={loading}
								onPress={requestClose}
								hitSlop={CLOSE_HIT_SLOP}
								testID={testID === undefined ? undefined : `${testID}-close`}
								className={cn("absolute top-3 right-3 size-8 items-center justify-center rounded-full active:bg-muted", closeButtonClassName)}>
								<Icon icon={XIcon} size="sm" colorClassName="accent-icon" />
							</Pressable>
						) : null}
					</View>
				</View>
			</Modal>
		);
	}),
);

export interface DialogPartProps {
	readonly children: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The title and description, stacked. */
export const DialogHeader = React.memo(
	React.forwardRef<ViewInstance, DialogPartProps>(function DialogHeader({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn("gap-1.5", className)}>
				{children}
			</View>
		);
	}),
);

/** The dialog's heading; announced as a header. */
export const DialogTitle = React.memo(
	React.forwardRef<TextInstance, DialogPartProps>(function DialogTitle({ children, className, testID }, ref): React.JSX.Element {
		return (
			<Text ref={ref} accessibilityRole="header" testID={testID} className={cn("text-h3 font-heading text-foreground", className)}>
				{children}
			</Text>
		);
	}),
);

/** What the dialog is about, or what will happen. */
export const DialogDescription = React.memo(
	React.forwardRef<TextInstance, DialogPartProps>(function DialogDescription({ children, className, testID }, ref): React.JSX.Element {
		return (
			<Text ref={ref} testID={testID} className={cn("text-body-lg font-sans text-muted-foreground", className)}>
				{children}
			</Text>
		);
	}),
);

export const dialogFooterVariants = cva("gap-2", {
	variants: {
		/** `stack`: full width, the primary action first (a phone's thumb-reach order). `row`: side by side, sharing the width. */
		layout: { stack: "", row: "flex-row" },
	},
	defaultVariants: { layout: "stack" },
});

export type DialogFooterLayout = NonNullable<VariantProps<typeof dialogFooterVariants>["layout"]>;

export interface DialogFooterProps extends DialogPartProps {
	readonly layout?: DialogFooterLayout | undefined;
}

/** The dialog's actions: stacked full width, or side by side (`layout="row"`). */
export const DialogFooter = React.memo(
	React.forwardRef<ViewInstance, DialogFooterProps>(function DialogFooter({ children, layout = "stack", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(dialogFooterVariants({ layout }), className)}>
				{children}
			</View>
		);
	}),
);

export const dialogBodyVariants = cva("", {
	variants: {
		/** `capped`: at most most of the screen, then it scrolls under the title. `fill`: the room a full-size dialog leaves. */
		height: { capped: "max-h-96", fill: "flex-1" },
	},
	defaultVariants: { height: "capped" },
});

export type DialogBodyHeight = NonNullable<VariantProps<typeof dialogBodyVariants>["height"]>;

export interface DialogBodyProps extends DialogPartProps {
	readonly height?: DialogBodyHeight | undefined;
}

/** Content too long for the card: it scrolls between the header and the footer, which stay in view. */
export const DialogBody = React.memo(
	React.forwardRef<ScrollViewInstance, DialogBodyProps>(function DialogBody({ children, height = "capped", className, testID }, ref): React.JSX.Element {
		return (
			<ScrollView
				ref={ref}
				testID={testID}
				keyboardShouldPersistTaps="handled"
				className={cn("grow-0", dialogBodyVariants({ height }), className)}
				contentContainerClassName="gap-3">
				{children}
			</ScrollView>
		);
	}),
);
