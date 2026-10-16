// A centred modal card over a dimmed scrim: a question, a short form, a
// detail that needs the person's full attention. The phone form of the web
// kit's Dialog (packages/ui/src/components/dialog.tsx), with the same parts —
// DialogHeader, DialogTitle, DialogDescription, DialogFooter — composed as
// children.
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
import { Modal, Pressable, Text, View } from "react-native";

import { cn } from "../lib/cn";
import { resolveControlState } from "../lib/control-state";
import { useReduceMotion } from "../lib/use-reduce-motion";

export const dialogVariants = cva("w-full gap-4 rounded-xl border bg-popover p-5 shadow-lg", {
	variants: {
		/** `destructive`: the dialog is about an irreversible action — its edge carries the destructive tone. */
		variant: {
			default: "border-border",
			destructive: "border-destructive",
		},
		size: {
			sm: "max-w-sm",
			md: "max-w-md",
			lg: "max-w-lg",
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
	/** Extra classes for the card, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Dialog = React.memo(
	React.forwardRef<View, DialogProps>(function Dialog(
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
						{children}
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
	React.forwardRef<View, DialogPartProps>(function DialogHeader({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn("gap-1.5", className)}>
				{children}
			</View>
		);
	}),
);

/** The dialog's heading; announced as a header. */
export const DialogTitle = React.memo(
	React.forwardRef<Text, DialogPartProps>(function DialogTitle({ children, className, testID }, ref): React.JSX.Element {
		return (
			<Text ref={ref} accessibilityRole="header" testID={testID} className={cn("font-heading text-lg text-foreground", className)}>
				{children}
			</Text>
		);
	}),
);

/** What the dialog is about, or what will happen. */
export const DialogDescription = React.memo(
	React.forwardRef<Text, DialogPartProps>(function DialogDescription({ children, className, testID }, ref): React.JSX.Element {
		return (
			<Text ref={ref} testID={testID} className={cn("font-sans text-base text-muted-foreground", className)}>
				{children}
			</Text>
		);
	}),
);

/** The dialog's actions, stacked full width (a phone's thumb-reach order: the primary action first). */
export const DialogFooter = React.memo(
	React.forwardRef<View, DialogPartProps>(function DialogFooter({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn("gap-2", className)}>
				{children}
			</View>
		);
	}),
);
