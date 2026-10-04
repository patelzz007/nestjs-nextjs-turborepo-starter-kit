import { VerifyEmailView } from "@workspace/client/lib/auth/email/verify-email-view";
import { EMAIL_VERIFICATION_LINK_TTL_HOURS, formatLinkLifetimeHours, VerifyEmailSchema } from "@workspace/shared";

import { AdminAuthLayout } from "@/components/auth/admin-auth-layout";
import { InvalidAuthLinkNotice } from "@/components/auth/invalid-auth-link-notice";
import { AUTH_LINK_TOKEN_PARAM, ROUTES } from "@/lib/routes";

export interface AdminVerifyEmailPageProps {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/auth/verify-email?token=` — the link the API emails to admins
 * (`APP_LINKS.auth.verifyEmail` on the admin origin). A token route: the proxy
 * serves it even while a session cookie is set, and restricted sessions may
 * visit it. Requesting a new link happens on `/account/security`. A server
 * component: the token is validated with the shared verify-email schema from
 * `searchParams`, so no `useSearchParams` + `Suspense` is needed.
 */
export default async function AdminVerifyEmailPage({ searchParams }: AdminVerifyEmailPageProps): Promise<React.JSX.Element> {
	const token = VerifyEmailSchema.shape.token.safeParse((await searchParams)[AUTH_LINK_TOKEN_PARAM]);

	return (
		<AdminAuthLayout
			icon="mail"
			tagline="Confirm your email to finish securing your administrator account."
			features={["One-click verification", "Secure token-based link", `Expires after ${formatLinkLifetimeHours(EMAIL_VERIFICATION_LINK_TTL_HOURS)}`]}
			title="Verify email"
			subtitle="We're confirming your email address">
			{token.success ? (
				<VerifyEmailView token={token.data} settingsHref={ROUTES.account.security} successRedirectHref={ROUTES.home} loginHref={ROUTES.auth.login} />
			) : (
				<InvalidAuthLinkNotice>This verification link is invalid. Request a new verification email from your account security page.</InvalidAuthLinkNotice>
			)}
		</AdminAuthLayout>
	);
}
