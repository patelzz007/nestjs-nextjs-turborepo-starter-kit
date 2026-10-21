"use client";

import { useWebSession } from "@/contexts/identity";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { hasMethod } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { toastMessage } from "@workspace/ui/components/toast";
import { Share2 } from "lucide-react";
import * as React from "react";

import { referralLinkPath, referralShareErrorMessage } from "../lib/referral-link";

/** How long "Link copied" stays on the button. */
const COPIED_FEEDBACK_MS = 2_000;

export interface RewardReferralShareProps {
	readonly rewardId: string;
	readonly rewardTitle: string;
}

/**
 * "Share with a friend" on a reward whose referrals are on: mints a fresh link (each link credits one
 * friend), then hands it to the system share sheet, or copies it where there is none. Signed-in
 * customers only; the API checks the reward can be shared and caps unused links.
 */
export const RewardReferralShare = React.forwardRef<HTMLButtonElement, RewardReferralShareProps>(function RewardReferralShare(
	{ rewardId, rewardTitle },
	ref,
): React.JSX.Element | null {
	const { api } = useAuth();
	const { isAuthenticated } = useWebSession();
	const [copied, setCopied] = React.useState(false);

	const createLink = api.referrals.createLink.useMutation({
		onSuccess: async (envelope): Promise<void> => {
			const url = new URL(referralLinkPath(rewardId, envelope.data.attributionToken), window.location.origin).toString();
			// The system share sheet where the browser has one (phones); otherwise the link is copied.
			if (hasMethod(navigator, "share")) {
				await navigator.share({ title: rewardTitle, url }).catch((): void => undefined);
				return;
			}
			await navigator.clipboard.writeText(url);
			setCopied(true);
			window.setTimeout((): void => {
				setCopied(false);
			}, COPIED_FEEDBACK_MS);
		},
		onError: (error: Error): void => {
			toastMessage.error({ title: "Could not create a link", description: referralShareErrorMessage(error) });
		},
	});
	const { mutate } = createLink;

	const handleClick = React.useCallback((): void => {
		mutate({ rewardId });
	}, [mutate, rewardId]);

	if (!isAuthenticated) {
		return null;
	}
	return (
		<Button ref={ref} type="button" variant="outline" className="w-full" onClick={handleClick} disabled={createLink.isPending}>
			<Share2 className="size-4" aria-hidden="true" />
			{copied ? "Link copied" : "Share with a friend"}
		</Button>
	);
});
