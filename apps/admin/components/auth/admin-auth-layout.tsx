import { AuthLayout, type AuthLayoutLabels } from "@workspace/ui/components/layout/auth-layout";
import { KeyRound, MailCheck, ShieldCheck, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { ROUTES } from "@/lib/routes";

/** Product name shown in the brand panel and the copyright line of every admin auth page. */
export const ADMIN_AUTH_BRAND_NAME = "Admin Panel";

const ADMIN_AUTH_LABELS: AuthLayoutLabels = {
	mobileBack: "Back",
	toggleThemeAria: "Toggle theme",
	rightsReserved: "All rights reserved.",
};

/** The brand-panel icon of each auth page. */
export type AdminAuthIcon = "shield" | "key" | "mail";

const ADMIN_AUTH_ICONS: Readonly<Record<AdminAuthIcon, LucideIcon>> = {
	shield: ShieldCheck,
	key: KeyRound,
	mail: MailCheck,
};

export interface AdminAuthLayoutProps {
	readonly icon: AdminAuthIcon;
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
 * the admin branding, labels and back link filled in once, so the four auth
 * pages only state what differs (icon, copy, form).
 */
export function AdminAuthLayout({ icon, tagline, features, title, subtitle, showBackToLogin = false, children }: AdminAuthLayoutProps): React.JSX.Element {
	const Icon = ADMIN_AUTH_ICONS[icon];
	return (
		<AuthLayout
			logo={<Icon className="size-5" aria-hidden="true" />}
			brandName={ADMIN_AUTH_BRAND_NAME}
			tagline={tagline}
			features={features}
			title={title}
			subtitle={subtitle}
			copyright={ADMIN_AUTH_BRAND_NAME}
			labels={ADMIN_AUTH_LABELS}
			{...(showBackToLogin ? { showBackButton: true, backHref: ROUTES.auth.login, backLabel: "Back to sign in" } : {})}>
			{children}
		</AuthLayout>
	);
}
