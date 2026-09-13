"use client";

import { Button } from "@workspace/ui/components/form/button";
import { useCallback, type JSX } from "react";

import type { DemoAccount, SocialProvider } from "./login-form-types";

export const SOCIAL_PROVIDERS: readonly SocialProvider[] = [
	{
		id: "google",
		label: "Google",
		icon: (
			<svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
				<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
				<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
				<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
				<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
			</svg>
		),
	},
	{
		id: "facebook",
		label: "Facebook",
		icon: (
			<svg className="size-4" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
				<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
			</svg>
		),
	},
	{
		id: "twitter",
		label: "Twitter",
		icon: (
			<svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
			</svg>
		),
	},
	{
		id: "github",
		label: "GitHub",
		icon: (
			<svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
			</svg>
		),
	},
];

interface SocialButtonProps {
	readonly provider: SocialProvider;
	readonly disabled: boolean;
	readonly onSelect: (provider: SocialProvider) => void;
}

export function SocialButton({ provider, disabled, onSelect }: SocialButtonProps): JSX.Element {
	const handleClick = useCallback((): void => {
		onSelect(provider);
	}, [provider, onSelect]);

	return (
		<Button type="button" variant="outline" className="h-12 bg-transparent" disabled={disabled} onClick={handleClick}>
			{provider.icon}
			{provider.label}
		</Button>
	);
}

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
