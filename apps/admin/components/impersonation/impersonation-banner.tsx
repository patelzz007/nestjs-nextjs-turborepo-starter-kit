"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { useImpersonation } from "@workspace/client/lib/auth/session/use-impersonation";
import { APP_LINKS } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import * as React from "react";

import { clientEnv } from "@/lib/env/env.client";

/**
 * Banner shown while a super-admin is impersonating another user.
 */
export function ImpersonationBanner(): React.JSX.Element | null {
	const { api } = useAuth();
	const router = useRouter();

	const permissionsQuery = api.auth.permissions.useQuery(undefined, {
		retry: 1,
	});

	const handleIdentityChanged = React.useCallback((): void => {
		router.refresh();
	}, [router]);
	const { stop, isPending } = useImpersonation({ onIdentityChanged: handleIdentityChanged });

	const session = permissionsQuery.data?.data;
	const isImpersonating = session?.isImpersonating === true;

	const webUrl: string = clientEnv.NEXT_PUBLIC_WEB_URL;
	const merchantUrl: string = clientEnv.NEXT_PUBLIC_MERCHANT_URL;

	if (!isImpersonating) {
		return null;
	}

	return (
		<div className="shrink-0 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2.5">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div className="flex min-w-0 items-start gap-2 text-sm leading-snug text-amber-950 dark:text-amber-100">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span className="min-w-0">You are impersonating another user. Actions run as the impersonated account.</span>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<a href={`${webUrl}${APP_LINKS.web.rewardHub}`} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">
						Consumer portal
					</a>
					<a href={merchantUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">
						Merchant portal
					</a>
					<Button size="sm" variant="outline" disabled={isPending} onClick={stop}>
						{isPending ? "Stopping…" : "Stop impersonation"}
					</Button>
				</div>
			</div>
		</div>
	);
}
