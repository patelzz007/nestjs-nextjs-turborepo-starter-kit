import { LoginForm } from "@workspace/client/lib/auth/forms/login-form";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
import * as React from "react";

import { loadWebDemoAccounts } from "@/lib/auth/demo-accounts";
import { ROUTES } from "@/lib/routes";

/**
 * `/auth/login` — consumer sign-in. A server component, so the seeded demo
 * logins reach the client form in development only, decided on the server per
 * request — demo credentials never ship in a production build or client bundle.
 */
export default async function WebLoginPage(): Promise<React.JSX.Element> {
	const demoAccounts = await loadWebDemoAccounts();

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
			copyright="Reward Hub">
			<LoginForm
				{...(demoAccounts.length > 0 ? { demoAccounts } : {})}
				redirectPath={ROUTES.rewardHub.browse}
				footer={
					<p className="text-center text-xs text-balance text-muted-foreground">
						Don&apos;t have an account?{" "}
						<a href={ROUTES.auth.signup} className="font-medium text-primary underline-offset-4 hover:underline">
							Sign up
						</a>
					</p>
				}
			/>
		</AuthLayout>
	);
}
