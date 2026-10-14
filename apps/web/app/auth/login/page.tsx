import { LoginForm } from "@workspace/client/lib/auth/forms/login-form";
import { isStringPrimitive } from "@workspace/shared";
import * as React from "react";

import { loadWebDemoAccounts } from "@/lib/auth/demo-accounts";
import { isAllowedWebPostLoginRedirect } from "@/lib/auth/routes";
import { LOGIN_REDIRECT_PARAM, ROUTES } from "@/lib/routes";

import { WebLoginAuthLayout } from "./login-auth-layout";

export interface WebLoginPageProps {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Where a member goes after signing in: the `?redirect=` page the proxy or a
 * page guard sent them from, when the shared allow-list accepts it — otherwise
 * the browse page.
 */
function resolveRedirectPath(redirect: string | string[] | undefined): string {
	return isStringPrimitive(redirect) && isAllowedWebPostLoginRedirect(redirect) ? redirect : ROUTES.rewardHub.browse;
}

/**
 * `/auth/login` — consumer sign-in. A server component: it resolves
 * `?redirect=` (so a member returns to the page that asked them to sign in),
 * and the seeded demo logins reach the client form in development only,
 * decided on the server per request — demo credentials never ship in a
 * production build or client bundle.
 */
export default async function WebLoginPage({ searchParams }: WebLoginPageProps): Promise<React.JSX.Element> {
	const params = await searchParams;
	const demoAccounts = await loadWebDemoAccounts();

	return (
		<WebLoginAuthLayout>
			<LoginForm
				{...(demoAccounts.length > 0 ? { demoAccounts } : {})}
				redirectPath={resolveRedirectPath(params[LOGIN_REDIRECT_PARAM])}
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
