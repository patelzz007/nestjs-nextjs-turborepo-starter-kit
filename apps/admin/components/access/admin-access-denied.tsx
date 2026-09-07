"use client";

import { ShieldAlert } from "lucide-react";
import * as React from "react";

export interface AdminAccessDeniedProps {
	readonly title?: string;
	readonly description?: string;
}

/** Standard forbidden state for admin capability gates. */
export function AdminAccessDenied({
	title = "You don't have access to this page",
	description = "Your role doesn't include permission for this feature. Contact an administrator if you need access.",
}: AdminAccessDeniedProps): React.JSX.Element {
	return (
		<div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
			<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
				<ShieldAlert className="size-6 text-muted-foreground" aria-hidden="true" />
			</div>
			<h1 className="text-lg font-semibold text-foreground">{title}</h1>
			<p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
		</div>
	);
}
