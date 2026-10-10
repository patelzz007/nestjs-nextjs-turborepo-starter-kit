// The "Sign out?" confirmation, worded once for every place that offers it.

import * as React from "react";

import { ConfirmDialog } from "../../components/confirm-dialog";
import type { SignOutConfirmation } from "./use-sign-out-confirmation";

export interface SignOutDialogProps {
	readonly confirmation: SignOutConfirmation;
}

export function SignOutDialog({ confirmation }: SignOutDialogProps): React.JSX.Element {
	return (
		<ConfirmDialog
			visible={confirmation.isConfirming}
			title="Sign out?"
			description="You'll need your password to sign in again on this device."
			confirmLabel="Sign out"
			cancelLabel="Cancel"
			onConfirm={confirmation.confirm}
			onCancel={confirmation.cancel}
			pending={confirmation.isSigningOut}
			destructive
		/>
	);
}
