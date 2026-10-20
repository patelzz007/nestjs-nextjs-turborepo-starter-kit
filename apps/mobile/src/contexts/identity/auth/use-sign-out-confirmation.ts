// Signing out with a confirmation step, shared by every place that offers
// "Sign out" (Settings, the app drawer): ask, then confirm or cancel. While
// the sign-out runs the dialog shows it is pending; the root guard then leaves
// for sign-in. A failed sign-out (the device could not be cleared) lets the
// user try again.

import * as React from "react";

import { useSignOut } from "./use-sign-out";

export interface SignOutConfirmation {
	readonly isConfirming: boolean;
	readonly isSigningOut: boolean;
	readonly ask: () => void;
	readonly cancel: () => void;
	readonly confirm: () => void;
}

export function useSignOutConfirmation(): SignOutConfirmation {
	const { signOut } = useSignOut();
	const [isConfirming, setConfirming] = React.useState(false);
	const [isSigningOut, setSigningOut] = React.useState(false);

	const ask = React.useCallback((): void => {
		setConfirming(true);
	}, []);
	const cancel = React.useCallback((): void => {
		setConfirming(false);
	}, []);
	const confirm = React.useCallback((): void => {
		setSigningOut(true);
		// The device leaves whatever the API answers; the root guard then shows sign-in.
		signOut().catch((): void => {
			setSigningOut(false);
		});
	}, [signOut]);

	return { isConfirming, isSigningOut, ask, cancel, confirm };
}
