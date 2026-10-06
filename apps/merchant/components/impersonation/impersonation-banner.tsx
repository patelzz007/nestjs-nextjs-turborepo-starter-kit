"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { useImpersonation } from "@workspace/client/lib/auth/session/use-impersonation";
import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import * as React from "react";

export interface ImpersonationBannerProps {
	/** Decoded server-side from the merchant JWT so the banner paints in SSR HTML. */
	readonly initialIsImpersonating?: boolean;
}

/** Banner shown while a super-admin impersonates another user in the merchant portal. */
export function ImpersonationBanner({ initialIsImpersonating = false }: ImpersonationBannerProps): React.JSX.Element | null {
	const { api } = useAuth();
	const router = useRouter();

	const permissionsQuery = api.auth.permissions.useQuery(undefined, { retry: 1 });

	const handleIdentityChanged = React.useCallback((): void => {
		router.refresh();
	}, [router]);
	const { stop, isPending } = useImpersonation({ onIdentityChanged: handleIdentityChanged });

	const session = permissionsQuery.data?.data;
	const isImpersonating = permissionsQuery.isFetched ? session?.isImpersonating === true : initialIsImpersonating;

	if (!isImpersonating) {
		return null;
	}

	return (
		<div className="shrink-0 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2.5">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div className="flex min-w-0 items-start gap-2 text-sm leading-snug text-amber-950 dark:text-amber-100">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span className="min-w-0">Impersonation active — merchant actions run as the impersonated account.</span>
				</div>
				<Button size="sm" variant="outline" className="shrink-0" disabled={isPending} onClick={stop}>
					{isPending ? "Stopping…" : "Stop impersonation"}
				</Button>
			</div>
		</div>
	);
}
