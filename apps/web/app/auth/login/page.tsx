import { LoginForm } from "@workspace/client/lib/auth/forms/login-form";
import * as React from "react";

import { loadWebDemoAccounts } from "@/lib/auth/demo-accounts";
import { ROUTES } from "@/lib/routes";

import { WebLoginAuthLayout } from "./login-auth-layout";

/**
 * `/auth/login` — consumer sign-in. A server component, so the seeded demo
 * logins reach the client form in development only, decided on the server per
 * request — demo credentials never ship in a production build or client bundle.
 */
export default async function WebLoginPage(): Promise<React.JSX.Element> {
	const demoAccounts = await loadWebDemoAccounts();

	return (
		<WebLoginAuthLayout>
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
		</WebLoginAuthLayout>
	);
}
