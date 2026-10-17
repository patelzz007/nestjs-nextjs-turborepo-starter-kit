"use client";

import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { AlertTriangle } from "lucide-react";
import * as React from "react";

export interface MerchantRouteErrorStateProps {
	/** Next.js's id of the server error — matches the server log line (`settleServerQuery` logged it there). */
	readonly digest: string | undefined;
	readonly onRetry: () => void;
	readonly className?: string;
}

/**
 * What a route's `error.tsx` renders: a generic, user-safe explanation (the
 * error's own message may carry server details and is never shown), the
 * reference to quote to support, and a retry.
 */
export function MerchantRouteErrorState({ digest, onRetry, className }: MerchantRouteErrorStateProps): React.JSX.Element {
	const handleRetry = React.useCallback((): void => {
		onRetry();
	}, [onRetry]);

	return (
		<div role="alert" className={className}>
			<Empty className="border bg-card">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<AlertTriangle className="size-5" aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle role="heading" aria-level={2}>
						Something went wrong
					</EmptyTitle>
					<EmptyDescription>
						{digest === undefined
							? "This page could not be loaded. Try again in a moment."
							: `This page could not be loaded. Try again in a moment — if it keeps failing, quote reference ${digest} to support.`}
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button type="button" onClick={handleRetry}>
						Try again
					</Button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
