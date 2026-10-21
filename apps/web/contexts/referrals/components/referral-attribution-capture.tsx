"use client";

import { useWebSession } from "@/contexts/identity";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { referralAttributionMessage } from "../lib/referral-link";

export interface ReferralAttributionCaptureProps {
	/** The token the page was opened with (`?ref=`), already checked against the contract; `null` for none. */
	readonly attributionToken: string | null;
	/** Tells the page what happened to the link, for its status line. */
	readonly onMessage: (message: string) => void;
}

/**
 * Records the referral link a signed-in visitor opened (`POST /referrals/attribution`), once, then
 * drops `?ref=` from the address so a reload or a shared screenshot does not carry it on. A guest
 * keeps the token in the URL: the sign-in prompt returns to the same link, and it is recorded then.
 * Renders nothing.
 */
export function ReferralAttributionCapture({ attributionToken, onMessage }: ReferralAttributionCaptureProps): null {
	const { api } = useAuth();
	const { isAuthenticated } = useWebSession();
	const router = useRouter();
	const pathname = usePathname();
	const recordedToken = React.useRef<string | null>(null);

	const record = api.referrals.recordAttribution.useMutation({
		onSettled: (_data, error): void => {
			onMessage(referralAttributionMessage(error));
			router.replace(pathname, { scroll: false });
		},
	});
	const { mutate } = record;

	React.useEffect((): void => {
		if (!isAuthenticated || attributionToken === null || recordedToken.current === attributionToken) {
			return;
		}
		recordedToken.current = attributionToken;
		mutate({ attributionToken });
	}, [attributionToken, isAuthenticated, mutate]);

	return null;
}
