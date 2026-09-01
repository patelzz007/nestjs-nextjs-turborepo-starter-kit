"use client";

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
			{/* The form renders immediately — the proxy handles redirect for
			    authenticated users before the client JS even loads. */}
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
		</AuthLayout>
	);
}
