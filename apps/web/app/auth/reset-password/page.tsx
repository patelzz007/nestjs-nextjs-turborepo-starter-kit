"use client";

import { ResetPasswordForm } from "@workspace/client/lib/contexts/identity/forms/reset-password-form";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
import { useSearchParams } from "next/navigation";
import { Suspense, type JSX } from "react";
import { AuthFormSkeleton } from "@/components/loading/auth-form-skeleton";
import { RESET_PASSWORD_LOADING_LABELS } from "@/components/loading/loading-labels";
import { ROUTES } from "@/lib/routes";
import { BRAND_NAME } from "@workspace/tokens";

/** The reset form's fields: new password and its confirmation. */
const RESET_PASSWORD_FIELD_COUNT = 2;

function ResetPasswordContent(): JSX.Element {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	if (token === null || token.length === 0) {
		return (
			<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
				This reset link is invalid. Please request a new password reset email.
			</div>
		);
	}

	return <ResetPasswordForm token={token} />;
}

export default function WebResetPasswordPage(): JSX.Element {
	return (
		<AuthLayout
			brandName={BRAND_NAME}
			tagline="Choose a strong new password."
			features={["Must meet complexity requirements", "Cannot reuse recent passwords", "Other sessions will be signed out"]}
			title="Create new password"
			subtitle="Your new password must be different from previous passwords"
			copyright={BRAND_NAME}
			showBackButton
			backHref={ROUTES.auth.login}
			backLabel="Back to sign in">
			<Suspense fallback={<AuthFormSkeleton fields={RESET_PASSWORD_FIELD_COUNT} labels={RESET_PASSWORD_LOADING_LABELS} />}>
				<ResetPasswordContent />
			</Suspense>
		</AuthLayout>
	);
}
