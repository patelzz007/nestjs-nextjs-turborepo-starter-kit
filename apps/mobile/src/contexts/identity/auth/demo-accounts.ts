// ============================================
// demo-accounts.ts — which demo logins the sign-in screen offers (ADR 042)
// ============================================
// The mobile twin of the web apps' demo accounts (packages/client
// demo-accounts-policy): offered in development, and in a release build only
// when it was built with `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true` — an internal test
// APK, never a store build (ADR 042, amended 2026-10-29). The web decides on
// the server; the phone has no server, so the decision is the bundle itself:
// the list is imported only inside a branch whose test Metro folds at build
// time, so a release built without the flag contains neither the list nor its
// passwords. That branch lives in lib/env.ts (`loadBundledDemoAccounts`), the
// one file allowed to read `process.env`; this module only holds the list for
// the sign-in screen.

import * as React from "react";

import type { DemoAccount } from "../../../lib/demo-account-list";
import { loadBundledDemoAccounts } from "../../../lib/env";

export type { DemoAccount } from "../../../lib/demo-account-list";

const NO_DEMO_ACCOUNTS: readonly DemoAccount[] = [];

/** The demo logins to offer: the seeded accounts in a development or demo build, none otherwise. */
export function loadDemoAccounts(): Promise<readonly DemoAccount[]> {
	return loadBundledDemoAccounts();
}

/** The demo logins for the sign-in screen: none until loaded, and none at all in a store build. */
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
