import { Button } from "@workspace/ui/components/button";
import { AlertTriangle } from "lucide-react";
import * as React from "react";

import { WebEmptyState } from "@/components/web-ui/empty-state";

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
		<WebEmptyState
			className={className}
			title="Something went wrong"
			description={
				digest === undefined
					? "We couldn't load this page. Try again in a moment."
					: `We couldn't load this page. Try again in a moment. If it keeps happening, quote reference ${digest}.`
			}
			icon={<AlertTriangle className="size-5" aria-hidden="true" />}
			action={
				<Button type="button" onClick={onRetry}>
					Try again
				</Button>
			}
		/>
	);
}
