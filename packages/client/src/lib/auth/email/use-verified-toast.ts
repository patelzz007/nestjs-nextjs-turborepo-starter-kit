"use client";

import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { useEffect, useRef } from "react";

import { consumeEmailVerifiedToast } from "./verified-toast";

/**
 * Shows the one-time "email verified" toast the verify page left behind. The
 * session was already rotated and re-read by the verify page itself
 * (`VerifyEmailView`), so nothing is synced again here.
 */
export function useEmailVerifiedToast(): void {
	const handledRef = useRef(false);

	useEffect((): void => {
		if (handledRef.current || !consumeEmailVerifiedToast()) {
			return;
		}
		handledRef.current = true;

		toastMessage.success({
			title: "Email verified",
			description: "Your email address has been successfully verified.",
		});
	}, []);
}
