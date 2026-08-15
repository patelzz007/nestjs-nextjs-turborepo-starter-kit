"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { LoginForm, type DemoAccount } from "@workspace/client/lib/auth/login-form";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";

/**
 * One-click demo accounts — only rendered when
 * `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true` (local/dev convenience).
 * NEXT_PUBLIC_ vars are inlined into the client bundle at build time, so the
 * array stays out of production bundles when the flag is off.
 */
const WEB_DEMO_ACCOUNTS: readonly DemoAccount[] = [
	{ label: "👑 Super Admin", email: "superadmin@example.com", password: "SuperAdmin@123" },
	{ label: "🔐 Admin", email: "admin@example.com", password: "Admin@123" },
	{ label: "🛠️ Manager", email: "manager@example.com", password: "Manager@123" },
	{ label: "👤 User", email: "user@example.com", password: "User@123" },
];

const SHOW_DEMO_ACCOUNTS: boolean = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";

export default function WebLoginPage(): React.JSX.Element {
	const { isInitializing } = useAuth();

	return (
		<AuthLayout
			logo={
				<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
					/>
				</svg>
			}
			brandName="LinkHub"
			tagline="Shorten, share, and track your links — all in one place."
			features={["Shorten any URL in seconds", "Real-time click analytics", "Secure, fast & reliable"]}
			title="Login"
			subtitle="Enter your email below to login to your account"
			copyright="LinkHub">
			{/* On SSR + the first client render, auth state isn't established yet.
			    Rendering the form during that window would flash it on every reload
			    (and for logged-in users, the proxy is about to bounce them to /hello). */}
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
					demoAccounts={SHOW_DEMO_ACCOUNTS ? WEB_DEMO_ACCOUNTS : undefined}
					footer={
						<p className="text-center text-xs text-balance text-muted-foreground">
							Don&apos;t have an account?{" "}
							<a href="/auth/signup" className="font-medium text-primary underline-offset-4 hover:underline">
								Sign up
							</a>
						</p>
					}
				/>
			)}
		</AuthLayout>
	);
}
