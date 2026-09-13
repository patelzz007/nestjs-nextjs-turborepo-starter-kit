"use client";

import { useMerchantEnrollmentLock } from "@/lib/merchant-email-enrollment";
import { EmailVerificationPanel } from "@workspace/client/lib/auth/email-verification-panel";
import { Button } from "@workspace/ui/components/form/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/overlay/dialog";
import { Mail, ShieldAlert } from "lucide-react";
import * as React from "react";

/** Explains why portal navigation is locked until enrollment completes. */
export function EmailVerificationGateDialog(): React.JSX.Element | null {
	const { isLocked, enrollmentReason } = useMerchantEnrollmentLock();
	const [open, setOpen] = React.useState(true);

	const isMfaEnrollment = enrollmentReason === "mfa_enrollment";

	const handleOpenChange = React.useCallback((nextOpen: boolean): void => {
		setOpen(nextOpen);
	}, []);

	const handleContinue = React.useCallback((): void => {
		setOpen(false);
	}, []);

	if (!isLocked) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<div className="flex items-center gap-2">
						{isMfaEnrollment ? (
							<ShieldAlert className="size-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
						) : (
							<Mail className="size-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
						)}
						<DialogTitle>{isMfaEnrollment ? "Set up two-factor authentication to continue" : "Verify your email to continue"}</DialogTitle>
					</div>
					<DialogDescription>
						{isMfaEnrollment
							? "Rewards, Analytics, and other portal pages stay locked until two-factor authentication is enabled. Complete setup in Account settings below."
							: "Rewards, Analytics, and other portal pages stay locked until your email is verified. Check your inbox for the verification link, or resend it below."}
					</DialogDescription>
				</DialogHeader>
				{isMfaEnrollment ? null : <EmailVerificationPanel />}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={handleContinue}>
						Continue to settings
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
