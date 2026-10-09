// A confirmation for a consequential action (sign out, revoke a device). It
// names the consequence; the caller owns `visible` and the pending state.

import * as React from "react";
import { Modal, View } from "react-native";

import { Banner } from "./banner";
import { Button } from "./button";
import { BodyText, Subheading } from "./text";

export interface ConfirmDialogProps {
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
	readonly destructive?: boolean;
}

export function ConfirmDialog({
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
}: ConfirmDialogProps): React.JSX.Element {
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
			<View className="flex-1 items-center justify-center px-6">
				<View className="absolute inset-0 bg-scrim opacity-50" />
				<View accessibilityViewIsModal accessibilityRole="alert" className="w-full max-w-md gap-4 rounded-xl border border-border bg-popover p-5">
					<Subheading>{title}</Subheading>
					<BodyText>{description}</BodyText>
					{error === null ? null : <Banner tone="error" message={error} />}
					<View className="gap-2">
						<Button label={confirmLabel} variant={destructive ? "destructive" : "primary"} loading={pending} onPress={onConfirm} />
						<Button label={cancelLabel} variant="secondary" disabled={pending} onPress={onCancel} />
					</View>
				</View>
			</View>
		</Modal>
	);
}
