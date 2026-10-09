// "Sign out everywhere" with its confirmation (§10.10, §10.11): every device,
// every app, this phone included. On failure nothing changed and the dialog says so.

import * as React from "react";

import { Button } from "../../components/button";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { useSignOut } from "../auth/use-sign-out";
import { DEVICES_COPY } from "./labels";

export function SignOutEverywhere(): React.JSX.Element {
	const { signOutEverywhere } = useSignOut();
	const [isOpen, setOpen] = React.useState(false);
	const [pending, setPending] = React.useState(false);
	const [failure, setFailure] = React.useState<string | null>(null);

	const open = React.useCallback((): void => {
		setFailure(null);
		setOpen(true);
	}, []);
	const close = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const confirm = React.useCallback((): void => {
		setPending(true);
		setFailure(null);
		const settle = (signedOut: boolean): void => {
			setPending(false);
			// On success this screen is gone (the root guard shows sign-in).
			if (!signedOut) {
				setFailure(DEVICES_COPY.signOutEverywhereFailed);
			}
		};
		signOutEverywhere().then(settle, (): void => {
			settle(false);
		});
	}, [signOutEverywhere]);

	return (
		<>
			<Button label={DEVICES_COPY.signOutEverywhere} variant="secondary" onPress={open} />
			<ConfirmDialog
				visible={isOpen}
				title={DEVICES_COPY.signOutEverywhereTitle}
				description={DEVICES_COPY.signOutEverywhereDescription}
				confirmLabel={DEVICES_COPY.signOutEverywhere}
				cancelLabel={DEVICES_COPY.cancel}
				onConfirm={confirm}
				onCancel={close}
				pending={pending}
				error={failure}
				destructive
			/>
		</>
	);
}
