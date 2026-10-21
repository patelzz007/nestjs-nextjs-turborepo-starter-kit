"use client";

import { Button } from "@workspace/ui/components/button";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useImpersonation } from "../session/use-impersonation";

export interface ImpersonationBannerBarProps {
	/** What runs as the impersonated account, in this app's words. */
	readonly message: string;
	/** Links shown before the stop button (the admin's other portals); none by default. */
	readonly links?: React.ReactNode;
}

/**
 * The bar every web app shows while a super-admin impersonates someone: the warning, optional links,
 * and "Stop impersonation" (`POST /auth/stop-impersonation`, which any impersonation session may call),
 * refreshing the server-rendered page once the identity is back. Each app decides when to show it,
 * from wherever it reads its session.
 */
export function ImpersonationBannerBar({ message, links }: ImpersonationBannerBarProps): React.JSX.Element {
	const router = useRouter();
	const handleIdentityChanged = React.useCallback((): void => {
		router.refresh();
	}, [router]);
	const { stop, isPending } = useImpersonation({ onIdentityChanged: handleIdentityChanged });

	return (
		<div data-slot="impersonation-banner" className="shrink-0 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2.5">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div className="flex min-w-0 items-start gap-2 text-sm leading-snug text-amber-950 dark:text-amber-100">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span className="min-w-0">{message}</span>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{links}
					<Button size="sm" variant="outline" disabled={isPending} onClick={stop}>
						{isPending ? "Stopping…" : "Stop impersonation"}
					</Button>
				</div>
			</div>
		</div>
	);
}
