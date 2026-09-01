"use client";

import { LoginForm, type DemoAccount } from "@workspace/client/lib/auth/login-form";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";

const WEB_DEMO_ACCOUNTS: readonly DemoAccount[] = [
	{ label: "Super Admin", email: "superadmin@example.com", password: "SuperAdmin@123" },
	{ label: "Admin", email: "admin@example.com", password: "Admin@123" },
	{ label: "Manager", email: "manager@example.com", password: "Manager@123" },
	{ label: "User", email: "user@example.com", password: "User@123" },
];

const SHOW_DEMO_ACCOUNTS: boolean = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";

export default function WebLoginPage(): React.JSX.Element {
	return (
		<AuthLayout
			logo={
				<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
					/>
				</svg>
			}
			brandName="Reward Hub"
			tagline="Discover and claim local rewards in KL and Melaka."
			features={["Browse rewards by city and category", "Claim offers with OTP verification", "Redeem in-store with QR codes"]}
			title="Sign in"
			subtitle="Access your claimed rewards and account"
			copyright="Reward Hub"
			labels={{
				mobileBack: "Back",
				toggleThemeAria: "Toggle theme",
				rightsReserved: "All rights reserved.",
			}}>
			<LoginForm
				demoAccounts={SHOW_DEMO_ACCOUNTS ? WEB_DEMO_ACCOUNTS : undefined}
				redirectPath="/rewardhub"
				footer={
					<p className="text-center text-xs text-balance text-muted-foreground">
						Don&apos;t have an account?{" "}
						<a href="/auth/signup" className="font-medium text-primary underline-offset-4 hover:underline">
							Sign up
						</a>
					</p>
				}
			/>
		</AuthLayout>
	);
}
