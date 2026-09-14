import type { ReactNode } from "react";

import type { AuthAppMode } from "../edge/restricted-session";

/** Which app the form is authenticating for — drives endpoint + defaults. */
export type LoginFormMode = AuthAppMode;

/** A one-click demo account shown as a "Try demo accounts:" button. */
export interface DemoAccount {
	/** Display label, e.g. "Admin". */
	readonly label: string;
	readonly email: string;
	readonly password: string;
}

export interface LoginFormProps {
	/** @default mode === "admin" ? "admin@example.com" : "m@example.com" */
	readonly emailPlaceholder?: string;
	/** Prefills the email field (e.g. team invite or onboarding return links). */
	readonly defaultEmail?: string;
	/** @default mode === "admin" ? "/" : "/hello" */
	readonly redirectPath?: string;
	/** One-click demo accounts rendered under the social buttons. */
	readonly demoAccounts?: readonly DemoAccount[];
	readonly footer?: ReactNode;
	/**
	 * Selects the login endpoint (`apiRouter.auth.login` vs `.adminLogin` — the
	 * latter sends `X-Client-Type: admin` for cookie isolation) plus the
	 * per-app defaults above. @default "web"
	 */
	readonly mode?: LoginFormMode;
	/**
	 * Rejects accounts without `hasAdminAccess` after a successful login
	 * (the admin panel's privilege gate). @default mode === "admin"
	 */
	readonly requireAdminAccess?: boolean;
}

export interface SocialProvider {
	readonly id: "google" | "facebook" | "twitter" | "github";
	readonly label: string;
	readonly icon: ReactNode;
}
