// A confirmation for a consequential action (sign out, revoke a device): a
// Dialog (./dialog.tsx) announced as an alert dialog, that names the
// consequence and offers the ways out — confirm, or cancel. A tap on the
// scrim does nothing (the person must choose); the Android back button
// cancels. The caller owns `visible` and the pending state: while `pending`,
// the dialog stays open, the confirm button spins and nothing can close it.
//
// `media` puts an icon tile above the title (or beside it, with
// `mediaPlacement="start"`); `children` sit between the description and the
// actions (a receipt, a checklist, a "don't ask again" checkbox). Without a
// `cancelLabel` there is one action (a notice). `actionsLayout` stacks the
// buttons, sets them side by side, or splits the footer into two flush cells.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { resolveControlState } from "../lib/control-state";
import { Alert } from "./alert";
import { Button } from "./button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

export const alertDialogVariants = cva("", {
	variants: {
		/** `destructive`: confirming cannot be undone — the confirm button carries the destructive tone. */
		variant: { default: "", destructive: "" },
		size: { sm: "", md: "", lg: "" },
		state: { default: "", loading: "", disabled: "", error: "" },
		/** `split`: the footer's two cells meet the card's edges. */
		actionsLayout: { stack: "", row: "", split: "overflow-hidden pb-0" },
	},
	defaultVariants: { variant: "default", size: "md", state: "default", actionsLayout: "stack" },
});

/** Where the title and description sit: at the start, or centred under centred media. */
export const alertDialogHeaderVariants = cva("", {
	variants: {
		align: { start: "", center: "items-center" },
	},
	defaultVariants: { align: "start" },
});

const alertDialogTextVariants = cva("", {
	variants: {
		align: { start: "", center: "text-center" },
	},
	defaultVariants: { align: "start" },
});

/** One of the split footer's two flush cells. */
const alertDialogSplitCellVariants = cva("h-12 flex-1 items-center justify-center active:bg-muted", {
	variants: {
		/** The cancel cell is ruled off from the confirm cell. */
		first: { true: "border-r border-border", false: "" },
	},
	defaultVariants: { first: false },
});

const alertDialogSplitLabelVariants = cva("font-sans-semibold text-body-lg", {
	variants: {
		tone: { default: "text-foreground", primary: "text-primary", destructive: "text-destructive-foreground" },
	},
	defaultVariants: { tone: "default" },
});

type AlertDialogVariantProps = VariantProps<typeof alertDialogVariants>;
export type AlertDialogVariant = NonNullable<AlertDialogVariantProps["variant"]>;
export type AlertDialogSize = NonNullable<AlertDialogVariantProps["size"]>;
export type AlertDialogActionsLayout = NonNullable<AlertDialogVariantProps["actionsLayout"]>;
export type AlertDialogAlign = NonNullable<VariantProps<typeof alertDialogHeaderVariants>["align"]>;

export interface AlertDialogProps {
	readonly visible: boolean;
	readonly title: string;
	readonly description: string;
	readonly confirmLabel: string;
	/** The way out. Without it there is one action, and the back button confirms nothing: it calls `onCancel`. */
	readonly cancelLabel?: string | undefined;
	readonly onConfirm: () => void;
	readonly onCancel: () => void;
	/** The confirmed action is running: the dialog stays open and blocks both buttons. */
	readonly pending?: boolean | undefined;
	/** Why the confirmed action failed, shown in the dialog so the user can retry. */
	readonly error?: string | null | undefined;
	/** Shorthand for `variant="destructive"`. */
	readonly destructive?: boolean | undefined;
	/** The confirm button cannot be pressed yet (a box to tick first). */
	readonly confirmDisabled?: boolean | undefined;
	readonly variant?: AlertDialogVariant | undefined;
	readonly size?: AlertDialogSize | undefined;
	/** An icon tile (or a picture) for the dialog: above the title, or beside it. */
	readonly media?: React.ReactNode | undefined;
	readonly mediaPlacement?: "top" | "start" | undefined;
	/** Where the title and description sit. Default `start`. */
	readonly align?: AlertDialogAlign | undefined;
	/** Between the description and the actions: a receipt, a checklist, a checkbox. */
	readonly children?: React.ReactNode;
	/** The actions stacked (default), side by side, or as two flush cells. */
	readonly actionsLayout?: AlertDialogActionsLayout | undefined;
	/** Extra classes for the card, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface SplitCellProps {
	readonly label: string;
	readonly tone: "default" | "primary" | "destructive";
	readonly first: boolean;
	readonly disabled: boolean;
	readonly onPress: () => void;
}

function SplitCell({ label, tone, first, disabled, onPress }: SplitCellProps): React.JSX.Element {
	const accessibilityState = React.useMemo(() => ({ disabled }), [disabled]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={accessibilityState}
			disabled={disabled}
			onPress={onPress}
			className={cn(alertDialogSplitCellVariants({ first }), disabled ? "opacity-50" : undefined)}>
			<Text className={alertDialogSplitLabelVariants({ tone })}>{label}</Text>
		</Pressable>
	);
}

export const AlertDialog = React.memo(
	React.forwardRef<ViewInstance, AlertDialogProps>(function AlertDialog(
		{
			visible,
			title,
			description,
			confirmLabel,
			cancelLabel,
			onConfirm,
			onCancel,
			pending = false,
			error = null,
			destructive = false,
			confirmDisabled = false,
			variant,
			size = "md",
			media,
			mediaPlacement = "top",
			align = "start",
			children,
			actionsLayout = "stack",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const resolvedVariant: AlertDialogVariant = variant ?? (destructive ? "destructive" : "default");
		const failed = error !== null;
		const state = resolveControlState({ loading: pending, invalid: failed });
		const confirmVariant = resolvedVariant === "destructive" ? "destructive" : "primary";

		const changeOpen = React.useCallback(
			(open: boolean): void => {
				if (!open) {
					onCancel();
				}
			},
			[onCancel],
		);

		const heading = (
			<DialogHeader className={alertDialogHeaderVariants({ align })}>
				<DialogTitle className={alertDialogTextVariants({ align })}>{title}</DialogTitle>
				<DialogDescription className={alertDialogTextVariants({ align })}>{description}</DialogDescription>
			</DialogHeader>
		);

		return (
			<Dialog
				ref={ref}
				open={visible}
				onOpenChange={changeOpen}
				role="alertdialog"
				variant={resolvedVariant}
				size={size}
				loading={pending}
				invalid={failed}
				dismissible={false}
				testID={testID}
				className={cn(alertDialogVariants({ variant: resolvedVariant, size, state, actionsLayout }), className)}>
				{media !== undefined && mediaPlacement === "start" ? (
					<View className="flex-row gap-4">
						{media}
						<View className="flex-1">{heading}</View>
					</View>
				) : (
					<>
						{media === undefined ? null : <View className={cn(align === "center" ? "items-center" : undefined)}>{media}</View>}
						{heading}
					</>
				)}
				{children}
				{error === null ? null : <Alert tone="error" message={error} />}
				{actionsLayout === "split" ? (
					<View className="-mx-6 flex-row border-t border-border">
						{cancelLabel === undefined ? null : <SplitCell label={cancelLabel} tone="default" first disabled={pending} onPress={onCancel} />}
						<SplitCell label={confirmLabel} tone={confirmVariant} first={false} disabled={pending || confirmDisabled} onPress={onConfirm} />
					</View>
				) : (
					<DialogFooter layout={actionsLayout === "row" ? "row" : "stack"}>
						{actionsLayout === "row" && cancelLabel !== undefined ? (
							<Button label={cancelLabel} variant="outline" disabled={pending} onPress={onCancel} className="flex-1" />
						) : null}
						<Button
							label={confirmLabel}
							variant={confirmVariant}
							loading={pending}
							disabled={confirmDisabled}
							onPress={onConfirm}
							className={actionsLayout === "row" ? "flex-1" : undefined}
						/>
						{actionsLayout === "stack" && cancelLabel !== undefined ? <Button label={cancelLabel} variant="outline" disabled={pending} onPress={onCancel} /> : null}
					</DialogFooter>
				)}
			</Dialog>
		);
	}),
);
