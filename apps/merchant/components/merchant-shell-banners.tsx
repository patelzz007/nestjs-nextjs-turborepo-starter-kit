"use client";

import { EmailVerificationBanner } from "@/contexts/identity/components/email-verification-banner";
import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner";
import { SessionCheckNotice } from "@workspace/client/lib/contexts/identity/session/session-check-notice";
import * as React from "react";

export interface MerchantShellBannersProps {
	readonly initialIsImpersonating?: boolean;
}

export function MerchantShellBanners({ initialIsImpersonating = false }: MerchantShellBannersProps): React.JSX.Element {
	return (
		<>
			<ImpersonationBanner initialIsImpersonating={initialIsImpersonating} />
			<EmailVerificationBanner />
			<SessionCheckNotice />
		</>
	);
}
