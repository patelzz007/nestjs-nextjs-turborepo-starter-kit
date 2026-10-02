"use client";

import { LoginForm, type DemoAccount } from "@workspace/client/lib/auth/forms/login-form";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";

import { MerchantAuthLogo } from "@/app/auth/merchant-auth-logo";
import { isAllowedMerchantPostLoginRedirect } from "@/lib/auth/routes";
import { clientEnv } from "@/lib/env/env.client";
import { ROUTES } from "@/lib/routes";

const MERCHANT_DEMO_ACCOUNTS: readonly DemoAccount[] = [
	{ label: "Super Admin", email: "superadmin@example.com", password: "SuperAdmin@123" },
	{ label: "KL Owner", email: "brew.owner@kl-rewards.demo", password: "BrewOwner@123" },
	{ label: "Melaka Owner", email: "jonker.owner@melaka-rewards.demo", password: "JonkerOwner@123" },
	{ label: "KL Cashier", email: "brew.cashier@kl-rewards.demo", password: "BrewCashier@123" },
];

const SHOW_DEMO: boolean = clientEnv.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS;

function MerchantLoginContent(): JSX.Element {
	const searchParams = useSearchParams();
	const redirect = searchParams.get("redirect");
	const email = searchParams.get("email");
	// Same allow-list the proxy applies — never follow an off-site or unknown `?redirect=`.
	const redirectPath = redirect !== null && isAllowedMerchantPostLoginRedirect(redirect) ? redirect : ROUTES.home;

	return (
		<LoginForm
			mode="merchant"
			{...(SHOW_DEMO ? { demoAccounts: MERCHANT_DEMO_ACCOUNTS } : {})}
			redirectPath={redirectPath}
			{...(email !== null ? { defaultEmail: email } : {})}
			forgotPasswordHref={ROUTES.auth.forgotPassword}
		/>
	);
}

export default function MerchantLoginPage(): JSX.Element {
	return (
		<AuthLayout
			logo={<MerchantAuthLogo />}
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
			<Suspense fallback={<p className="text-sm text-muted-foreground">Loading sign in…</p>}>
				<MerchantLoginContent />
			</Suspense>
		</AuthLayout>
	);
}
