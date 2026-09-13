"use client";

import type { MerchantKybProfileResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import type { JSX } from "react";

import { kybStatusVariant } from "./verification-profile-utils";

export interface MerchantKybVerificationStatusBannersProps {
	readonly profile: MerchantKybProfileResponse;
	readonly rejectionReason: string | null;
	readonly successMessage: string | null;
}

export function MerchantKybVerificationStatusBanners({ profile, rejectionReason, successMessage }: MerchantKybVerificationStatusBannersProps): JSX.Element {
	return (
		<>
			<Badge variant={kybStatusVariant(profile.kybStatus)}>{profile.kybStatus}</Badge>

			{profile.kybStatus === "ACTION_REQUIRED" ? (
				<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
					A security scan flagged one or more documents. Please upload a clean set of files and resubmit.
				</div>
			) : null}

			{profile.kybStatus === "REJECTED" && rejectionReason !== null ? (
				<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{rejectionReason}</div>
			) : null}

			{successMessage !== null ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">{successMessage}</div> : null}
		</>
	);
}
