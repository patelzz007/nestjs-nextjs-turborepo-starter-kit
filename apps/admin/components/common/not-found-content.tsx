import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { NotFoundContent as SharedNotFoundContent } from "@workspace/ui/components/feedback/not-found-content";

/**
 * Admin wrapper around the **shared** presentational 404 content (rule 6 —
 * generic low-level component in `packages/ui`). This thin shell only supplies
 * the Next.js "back" link (the shared component is framework-free).
 */
export function AdminNotFoundContent({
	title,
	message,
	backHref,
	backLabel,
}: {
	readonly title?: string;
	readonly message?: string;
	readonly backHref: string;
	readonly backLabel: string;
}): React.JSX.Element {
	return (
		<SharedNotFoundContent
			code="404"
			title={title ?? "Page not found"}
			message={message ?? "The page you're looking for doesn't exist or may have been moved."}
			backLink={
				<Link
					href={backHref}
					className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
					<ArrowLeft className="size-4" />
					{backLabel}
				</Link>
			}
		/>
	);
}
