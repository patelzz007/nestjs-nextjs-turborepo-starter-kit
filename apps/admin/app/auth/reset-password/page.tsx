import { ResetPasswordForm } from "@workspace/client/lib/auth/forms/reset-password-form";
import { ResetPasswordSchema } from "@workspace/shared";

import { AdminAuthLayout } from "@/components/auth/admin-auth-layout";
import { InvalidAuthLinkNotice } from "@/components/auth/invalid-auth-link-notice";
import { AUTH_LINK_TOKEN_PARAM, ROUTES } from "@/lib/routes";

export interface AdminResetPasswordPageProps {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/auth/reset-password?token=` — the link the API emails for a password
 * reset. A server component: the token is read from `searchParams` and
 * validated with the shared reset schema here, so the client gets either a
 * form bound to a well-formed token or the invalid-link notice — no
 * `useSearchParams` + `Suspense` round trip.
 */
export default async function AdminResetPasswordPage({ searchParams }: AdminResetPasswordPageProps): Promise<React.JSX.Element> {
	const token = ResetPasswordSchema.shape.token.safeParse((await searchParams)[AUTH_LINK_TOKEN_PARAM]);

	return (
		<AdminAuthLayout
			icon="key"
			tagline="Choose a strong new password."
			features={["Must meet complexity requirements", "Cannot reuse recent passwords", "Other sessions will be signed out"]}
			title="Create new password"
			subtitle="Your new password must be different from previous passwords"
			showBackToLogin>
			{token.success ? (
				<ResetPasswordForm token={token.data} loginHref={ROUTES.auth.login} />
			) : (
				<InvalidAuthLinkNotice>This reset link is invalid. Please request a new password reset email.</InvalidAuthLinkNotice>
			)}
		</AdminAuthLayout>
	);
}
