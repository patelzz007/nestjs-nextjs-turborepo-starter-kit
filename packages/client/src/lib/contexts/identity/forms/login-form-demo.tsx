"use client";

import { Button } from "@workspace/ui/components/button";
import { useCallback, type JSX } from "react";

import type { DemoAccount } from "./login-form-types";

interface DemoAccountButtonProps {
	readonly account: DemoAccount;
	readonly disabled: boolean;
	readonly onSelect: (account: DemoAccount) => void;
}

export function DemoAccountButton({ account, disabled, onSelect }: DemoAccountButtonProps): JSX.Element {
	const handleClick = useCallback((): void => {
		onSelect(account);
	}, [account, onSelect]);

	return (
		<Button type="button" variant="outline" className="h-10 w-full bg-transparent text-sm" disabled={disabled} onClick={handleClick}>
			{account.label}
		</Button>
	);
}

/**
 * "Demo Information" box under the demo buttons — shows each account's
 * credentials so devs can also type them manually (and understand the roles).
 */
export function DemoInfoBox({ accounts }: { readonly accounts: readonly DemoAccount[] }): JSX.Element {
	return (
		<div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
			<p className="mb-2 text-center text-xs font-medium text-blue-700 dark:text-blue-400">Demo Information</p>
			<div className="space-y-1 text-center text-xs text-blue-700 dark:text-blue-400">
				{accounts.map((account) => (
					<div key={account.email} className="truncate">
						🔑 <strong>{account.label}:</strong> {account.email} / {account.password}
					</div>
				))}
				<div>👥 Each account has different permissions and menus</div>
			</div>
		</div>
	);
}
