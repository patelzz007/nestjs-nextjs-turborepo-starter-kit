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
