"use client";

import { Button } from "@workspace/ui/components/form/button";
import { CloudOff } from "lucide-react";
import * as React from "react";

export interface PermissionsLoadFailedProps {
	readonly onRetry: () => void;
}

/** Shown instead of a page when the session's permissions could not be fetched — distinct from "access denied". */
export function PermissionsLoadFailed({ onRetry }: PermissionsLoadFailedProps): React.JSX.Element {
	return (
		<div role="alert" className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
			<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
				<CloudOff className="size-6 text-muted-foreground" aria-hidden="true" />
			</div>
			<h1 className="text-lg font-semibold text-foreground">Couldn&apos;t load your permissions</h1>
			<p className="mt-2 max-w-md text-sm text-muted-foreground">
				The server could not be reached, so this page cannot tell what you may do here. Check your connection and try again.
			</p>
			<Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}>
				Try again
			</Button>
		</div>
	);
}
