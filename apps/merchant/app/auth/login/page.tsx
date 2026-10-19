import { LoginForm } from "@workspace/client/lib/contexts/identity/forms/login-form";
import { EmailAddressSchema, isStringPrimitive } from "@workspace/shared";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
import * as React from "react";

import { loadMerchantDemoAccounts } from "@/contexts/identity/lib/demo-accounts";
import { isAllowedMerchantPostLoginRedirect } from "@/contexts/identity/lib/routes";
import { ROUTES } from "@/lib/routes";
import { BRAND_NAME } from "@workspace/tokens";

export interface MerchantLoginPageProps {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The single value of a query parameter (`undefined` when absent or repeated). */
function singleParam(value: string | string[] | undefined): string | undefined {
	return isStringPrimitive(value) ? value : undefined;
}

/**
 * `/auth/login` — merchant sign-in. A server component: it resolves
 * `?redirect=` against the same allow-list the proxy applies, prefills a valid
 * `?email=` (from an invite link), and hands the seeded demo logins to the
 * client form in development only — so demo
 * credentials never ship in a production build or client bundle.
 */
export default async function MerchantLoginPage({ searchParams }: MerchantLoginPageProps): Promise<React.JSX.Element> {
	const params = await searchParams;
	const redirect = singleParam(params.redirect);
	const redirectPath = redirect !== undefined && isAllowedMerchantPostLoginRedirect(redirect) ? redirect : ROUTES.home;
	const email = EmailAddressSchema.safeParse(singleParam(params.email));
	const demoAccounts = await loadMerchantDemoAccounts();

	return (
		<AuthLayout
			brandName="Merchant Portal"
			tagline="Manage rewards, redemptions, and POS keys for your store."
			features={["Draft and publish rewards", "Track redemptions in real time", "Manage POS API keys securely"]}
			title="Merchant login"
			subtitle="Sign in with your store account"
			copyright={BRAND_NAME}>
			<LoginForm
				mode="merchant"
				{...(demoAccounts.length > 0 ? { demoAccounts } : {})}
				redirectPath={redirectPath}
				{...(email.success ? { defaultEmail: email.data } : {})}
				forgotPasswordHref={ROUTES.auth.forgotPassword}
			/>
		</AuthLayout>
	);
}
