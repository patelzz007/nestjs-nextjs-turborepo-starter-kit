"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { LoginForm, type DemoAccount } from "@workspace/client/lib/auth/login-form";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";
import Link from "next/link";

const ADMIN_DEMO_ACCOUNT: DemoAccount = { label: "🔐 Admin", email: "admin@example.com", password: "Admin@123" };

export interface LoginViewProps {
	/** Safe in-app path to land on after a successful login (from `?redirect=`). */
	readonly redirectPath: string;
	/** Web app URL for the "returning to main website" footer link. */
	readonly webBaseUrl: string;
	/** Whether the one-click demo account is enabled (env flag). */
	readonly showDemoAccounts: boolean;
}

export function LoginView({ redirectPath, webBaseUrl, showDemoAccounts }: LoginViewProps): React.JSX.Element {
	const { isInitializing } = useAuth();

	return (
		<AuthLayout
			logo={
				<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
					/>
				</svg>
			}
			brandName="Admin Panel"
			tagline="Manage users, roles, and permissions from one secure place."
			features={["Role-based access control", "Audit & activity logs", "Enterprise-grade security"]}
			title="Admin Login"
			subtitle="Sign in with your administrator credentials"
			copyright="Admin Panel"
			labels={{
				mobileBack: "Back",
				toggleThemeAria: "Toggle theme",
				rightsReserved: "All rights reserved.",
			}}>
			{/* On SSR + the first client render, auth state isn't established
			    yet. Rendering the form during that window would flash it on every
			    reload (and for admins, the proxy is about to bounce them into the
			    panel). The static brand panel still renders in the initial HTML —
			    only the form waits for the mount tick. */}
			{isInitializing ? (
				<div className="flex flex-col items-center gap-4 py-16">
					<svg className="size-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
						<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
						<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					<p className="text-sm text-muted-foreground">Loading…</p>
				</div>
			) : (
				<LoginForm
					mode="admin"
					redirectPath={redirectPath}
					demoAccounts={showDemoAccounts ? [ADMIN_DEMO_ACCOUNT] : undefined}
					footer={
						<p className="text-center text-xs text-balance text-muted-foreground">
							Returning to{" "}
							<Link href={webBaseUrl} className="font-medium text-primary underline-offset-4 hover:underline">
								main website
							</Link>
						</p>
					}
				/>
			)}
		</AuthLayout>
	);
}
