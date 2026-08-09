"use client";

import { Button } from "@workspace/ui/components/form/button";
import * as React from "react";

export interface PanelErrorProps {
	readonly error: Error;
	readonly reset: () => void;
}

/**
 * Error boundary for every authenticated panel route. Renders inside the
 * `(panel)` layout (sidebar/topbar stay mounted) and offers a retry.
 */
export default function PanelError({ error, reset }: PanelErrorProps): React.JSX.Element {
	const handleReset = React.useCallback((): void => {
		reset();
	}, [reset]);

	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
			<p className="text-2xl">⚠️</p>
			<h1 className="text-lg font-semibold">Something went wrong</h1>
			<p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
			<Button type="button" onClick={handleReset} className="mt-2">
				Try again
			</Button>
		</div>
	);
}
