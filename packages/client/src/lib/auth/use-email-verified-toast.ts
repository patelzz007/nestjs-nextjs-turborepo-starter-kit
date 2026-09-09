"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { useEffect, useRef } from "react";

import { consumeEmailVerifiedToast } from "./email-verified-toast";
import { useAuth } from "./index";
import { syncSessionAfterEmailVerification } from "./sync-session-after-email-verification";

/** Shows a one-time success toast and refreshes the session after email verification. */
export function useEmailVerifiedToast(): void {
	const queryClient = useQueryClient();
	const { api, login } = useAuth();
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

		void (async (): Promise<void> => {
			await syncSessionAfterEmailVerification(api, login, queryClient);
		})();
	}, [api, login, queryClient]);
}
