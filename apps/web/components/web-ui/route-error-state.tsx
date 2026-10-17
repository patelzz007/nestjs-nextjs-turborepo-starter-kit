import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { AlertTriangle } from "lucide-react";
import * as React from "react";

export interface RouteErrorStateProps {
	/** Server-side error digest — the identifier to match in the server log. Never the raw message. */
	readonly digest?: string | undefined;
	readonly onRetry: () => void;
	readonly className?: string | undefined;
}

/**
 * The fallback every web `error.tsx` renders: what happened, a retry, and the
 * error reference support can look up. The message of a server error is never
 * shown — Next.js replaces it in production, and it is not written for users.
 */
export function RouteErrorState({ digest, onRetry, className }: RouteErrorStateProps): React.JSX.Element {
	return (
		<Empty className={cn("border bg-card", className)}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<AlertTriangle className="size-5" aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle role="heading" aria-level={2}>
					Something went wrong
				</EmptyTitle>
				<EmptyDescription>
					{digest === undefined
						? "We couldn't load this page. Try again in a moment."
						: `We couldn't load this page. Try again in a moment. If it keeps happening, quote reference ${digest}.`}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button type="button" onClick={onRetry}>
					Try again
				</Button>
			</EmptyContent>
		</Empty>
	);
}
