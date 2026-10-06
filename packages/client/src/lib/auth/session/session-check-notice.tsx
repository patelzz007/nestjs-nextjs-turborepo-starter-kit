// ============================================
// lib/auth/session/session-check-notice.tsx - "can't reach the server" banner
// ============================================
// Mounted in each app's shell (banner slot). Shown only while this tab's
// session check cannot reach the API; the session status itself is never
// changed by that (an authenticated member stays signed in, an unknown tab is
// never shown as signed out), so the notice is informational and non-blocking.
"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { TriangleAlert } from "lucide-react";
import * as React from "react";

import { useAuthCommands, useSessionCheckStatus } from "../../features/auth/facade";

export interface SessionCheckNoticeProps {
	readonly className?: string | undefined;
}

/**
 * The live region is always rendered (empty while the check is healthy) so a
 * screen reader announces the message when it appears — a region inserted
 * together with its text is often not announced. Polite: it never interrupts.
 * The text does not change between automatic retries, so it is announced once
 * per state, not once per attempt.
 */
export function SessionCheckNotice({ className }: SessionCheckNoticeProps): React.JSX.Element {
	const check = useSessionCheckStatus();
	const { recheckSession } = useAuthCommands();

	return (
		<div role="status" aria-live="polite" data-slot="session-check-notice" className={cn("shrink-0", className)}>
			{check.status === "ok" ? null : (
				<Alert variant="warning" size="sm" role="none" className="rounded-none border-x-0 border-t-0">
					<TriangleAlert aria-hidden="true" />
					<AlertTitle>{check.status === "retrying" ? "Can't reach the server — retrying…" : "Can't reach the server"}</AlertTitle>
					<AlertDescription>
						{check.status === "retrying"
							? "We couldn't verify your session. This won't sign you out."
							: "We couldn't verify your session. We'll try again when your connection is back, or you can try now."}
					</AlertDescription>
					{check.status === "paused" ? (
						<AlertAction>
							<Button type="button" size="sm" variant="outline" onClick={recheckSession}>
								Try again
							</Button>
						</AlertAction>
					) : null}
				</Alert>
			)}
		</div>
	);
}
