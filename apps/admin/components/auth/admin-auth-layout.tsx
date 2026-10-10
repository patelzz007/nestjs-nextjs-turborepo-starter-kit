import { AuthLayout } from "@workspace/ui/components/auth-layout";
import type * as React from "react";

import { ROUTES } from "@/lib/routes";

/** Product name shown in the brand panel and the copyright line of every admin auth page. */
export const ADMIN_AUTH_BRAND_NAME = "Admin Panel";

export interface AdminAuthLayoutProps {
	readonly tagline: string;
	readonly features: readonly string[];
	readonly title: string;
	readonly subtitle: string;
	/** Shows a "Back to sign in" link (forgot / reset password). */
	readonly showBackToLogin?: boolean;
	readonly children: React.ReactNode;
}

/**
 * The admin app's auth-page frame: the shared split-screen `AuthLayout` with
 * the admin branding and back link filled in once, so the four auth
 * pages only state what differs (copy, form). The brand mark is AuthLayout's own.
 */
export function AdminAuthLayout({ tagline, features, title, subtitle, showBackToLogin = false, children }: AdminAuthLayoutProps): React.JSX.Element {
	return (
		<AuthLayout
			brandName={ADMIN_AUTH_BRAND_NAME}
			tagline={tagline}
			features={features}
			title={title}
			subtitle={subtitle}
			copyright={ADMIN_AUTH_BRAND_NAME}
			{...(showBackToLogin ? { showBackButton: true, backHref: ROUTES.auth.login, backLabel: "Back to sign in" } : {})}>
			{children}
		</AuthLayout>
	);
}
