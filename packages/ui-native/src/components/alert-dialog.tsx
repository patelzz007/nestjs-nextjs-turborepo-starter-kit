// A confirmation for a consequential action (sign out, revoke a device): a
// Dialog (./dialog.tsx) announced as an alert dialog, that names the
// consequence and offers exactly two ways out — confirm or cancel. A tap on
// the scrim does nothing (the person must choose); the Android back button
// cancels. The caller owns `visible` and the pending state: while `pending`,
// the dialog stays open, the confirm button spins and nothing can close it.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { resolveControlState } from "../lib/control-state";
import { Alert } from "./alert";
import { Button } from "./button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, type DialogSize } from "./dialog";

export const alertDialogVariants = cva("", {
	variants: {
		/** `destructive`: confirming cannot be undone — the confirm button and the card's edge carry the destructive tone. */
		variant: { default: "", destructive: "" },
		size: { sm: "", md: "", lg: "" },
		state: { default: "", loading: "", disabled: "", error: "" },
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

type AlertDialogVariantProps = VariantProps<typeof alertDialogVariants>;
export type AlertDialogVariant = NonNullable<AlertDialogVariantProps["variant"]>;
export type AlertDialogSize = DialogSize;

export interface AlertDialogProps {
	readonly visible: boolean;
	readonly title: string;
	readonly description: string;
	readonly confirmLabel: string;
	readonly cancelLabel: string;
	readonly onConfirm: () => void;
	readonly onCancel: () => void;
	/** The confirmed action is running: the dialog stays open and blocks both buttons. */
	readonly pending?: boolean;
	/** Why the confirmed action failed, shown in the dialog so the user can retry. */
	readonly error?: string | null;
	/** Shorthand for `variant="destructive"`. */
	readonly destructive?: boolean;
	readonly variant?: AlertDialogVariant;
	readonly size?: AlertDialogSize;
	/** Extra classes for the card, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
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
			variant,
			size = "md",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const resolvedVariant: AlertDialogVariant = variant ?? (destructive ? "destructive" : "default");
		const failed = error !== null;
		const state = resolveControlState({ loading: pending, invalid: failed });

		const changeOpen = React.useCallback(
			(open: boolean): void => {
				if (!open) {
					onCancel();
				}
			},
			[onCancel],
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
				className={cn(alertDialogVariants({ variant: resolvedVariant, size, state }), className)}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{error === null ? null : <Alert tone="error" message={error} />}
				<DialogFooter>
					<Button label={confirmLabel} variant={resolvedVariant === "destructive" ? "destructive" : "primary"} loading={pending} onPress={onConfirm} />
					<Button label={cancelLabel} variant="secondary" disabled={pending} onPress={onCancel} />
				</DialogFooter>
			</Dialog>
		);
	}),
);
