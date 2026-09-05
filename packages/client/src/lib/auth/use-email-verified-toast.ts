"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { useEffect, useRef } from "react";

import { consumeEmailVerifiedToast } from "./email-verified-toast";
import { useAuth } from "./index";
import { toAuthUser } from "./map-auth-user";

const AUTH_ME_QUERY_KEY: readonly ["auth", "me"] = ["auth", "me"];

/** Shows a one-time success toast and refreshes the session after email verification. */
export function useEmailVerifiedToast(): void {
	const queryClient = useQueryClient();
	const { api, login, user } = useAuth();
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

		if (user !== null) {
			login({ ...user, isEmailVerified: true });
		}

		void (async (): Promise<void> => {
			await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
			try {
				const meResponse = await api.auth.me.fetchOrThrow(undefined);
				login(toAuthUser(meResponse.data));
				queryClient.setQueryData(AUTH_ME_QUERY_KEY, meResponse);
			} catch {
				// Optimistic badge update remains when refetch fails.
			}
		})();
	}, [api.auth.me, login, queryClient, user]);
}
