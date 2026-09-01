"use client";

import { LoginForm, type DemoAccount } from "@workspace/client/lib/auth/login-form";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";

const MERCHANT_DEMO_ACCOUNTS: readonly DemoAccount[] = [
	{ label: "Super Admin", email: "superadmin@example.com", password: "SuperAdmin@123" },
	{ label: "KL Owner", email: "brew.owner@kl-rewards.demo", password: "BrewOwner@123" },
	{ label: "Melaka Owner", email: "jonker.owner@melaka-rewards.demo", password: "JonkerOwner@123" },
	{ label: "KL Cashier", email: "brew.cashier@kl-rewards.demo", password: "BrewCashier@123" },
];

const SHOW_DEMO: boolean = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";

export default function MerchantLoginPage(): React.JSX.Element {
	return (
		<AuthLayout
			logo={
				<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
				</svg>
			}
			brandName="Merchant Portal"
			tagline="Manage rewards, redemptions, and POS keys for your store."
			features={["Draft and publish rewards", "Track redemptions in real time", "Manage POS API keys securely"]}
			title="Merchant login"
			subtitle="Sign in with your store account"
			copyright="Reward Hub"
			labels={{
				mobileBack: "Back",
				toggleThemeAria: "Toggle theme",
				rightsReserved: "All rights reserved.",
			}}>
			<LoginForm mode="merchant" demoAccounts={SHOW_DEMO ? MERCHANT_DEMO_ACCOUNTS : undefined} redirectPath="/" />
		</AuthLayout>
	);
}
