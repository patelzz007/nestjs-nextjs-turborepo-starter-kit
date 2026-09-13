"use client";

import { useMerchantEnrollmentLock } from "@/lib/merchant-email-enrollment";
import { Button } from "@workspace/ui/components/form/button";
import { Mail, ShieldAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** Persistent banner shown while a merchant account still needs enrollment. */
export function EmailVerificationBanner(): React.JSX.Element | null {
	const { isLocked, enrollmentReason } = useMerchantEnrollmentLock();

	if (!isLocked) {
		return null;
	}

	const isMfaEnrollment = enrollmentReason === "mfa_enrollment";

	return (
		<div className="shrink-0 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2.5">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div className="flex min-w-0 items-start gap-2 text-sm leading-snug text-amber-950 dark:text-amber-100">
					{isMfaEnrollment ? (
						<ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					) : (
						<Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					)}
					<span className="min-w-0">
						{isMfaEnrollment
							? "Set up two-factor authentication to unlock the merchant portal. Other pages stay locked and redirect here until enrollment is complete."
							: "Verify your email to unlock the merchant portal. Other pages stay locked and redirect here until verification is complete."}
					</span>
				</div>
				<Button size="sm" variant="outline" className="shrink-0" nativeButton={false} render={<Link href="/settings" />}>
					Account settings
				</Button>
			</div>
		</div>
	);
}
