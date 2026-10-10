// ============================================
// demo-accounts.ts — which demo logins the sign-in screen offers (ADR 042)
// ============================================
// The mobile twin of the web apps' demo accounts (packages/client
// demo-accounts-policy): offered in development and never otherwise. The web
// decides on the server; the phone has no server, so the decision is the
// bundle itself: the list is imported only inside an `if (__DEV__)` branch.
// Metro replaces `__DEV__` with `false` in a production bundle and drops the
// branch — and the import with it — before it collects dependencies, so a
// store build contains neither the list nor its passwords (checked against an
// `expo export --no-bytecode` build). `__DEV__` must stay a literal here (not
// a variable), and the import must stay inside the branch (a top-level import
// is always bundled).

import * as React from "react";

/** A one-tap seeded login: the button's label and the credentials it signs in with. */
export interface DemoAccount {
	readonly label: string;
	readonly email: string;
	readonly password: string;
}

const NO_DEMO_ACCOUNTS: readonly DemoAccount[] = [];

/** The demo logins to offer: the seeded accounts in a development build, none otherwise. */
export async function loadDemoAccounts(): Promise<readonly DemoAccount[]> {
	if (__DEV__) {
		return (await import("./demo-account-list")).MOBILE_DEMO_ACCOUNTS;
	}
	return NO_DEMO_ACCOUNTS;
}

/** The demo logins for the sign-in screen: none until loaded, and none at all outside development. */
export function useDemoAccounts(): readonly DemoAccount[] {
	const [accounts, setAccounts] = React.useState<readonly DemoAccount[]>(NO_DEMO_ACCOUNTS);

	React.useEffect((): (() => void) => {
		let active = true;
		loadDemoAccounts()
			.then((loaded: readonly DemoAccount[]): void => {
				if (active) {
					setAccounts(loaded);
				}
			})
			.catch((): void => {
				// The list could not be loaded: offer no demo logins.
			});
		return (): void => {
			active = false;
		};
	}, []);

	return accounts;
}
