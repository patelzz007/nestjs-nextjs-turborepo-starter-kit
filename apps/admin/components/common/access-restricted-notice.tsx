"use client";

import { Lock } from "lucide-react";
import * as React from "react";

export interface AccessRestrictedNoticeProps {
	readonly title?: string;
	readonly description: string;
}

/**
 * Compact inline fallback for a section the session can view but not change
 * (or not see). Page-level denials use `AdminAccessDenied` instead.
 */
export function AccessRestrictedNotice({ title = "Read-only access", description }: AccessRestrictedNoticeProps): React.JSX.Element {
	return (
		<div role="note" className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm">
			<Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<div className="min-w-0">
				<p className="font-medium text-foreground">{title}</p>
				<p className="mt-0.5 text-muted-foreground">{description}</p>
			</div>
		</div>
	);
}
