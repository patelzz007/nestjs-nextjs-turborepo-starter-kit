import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { NotFoundContent } from "@workspace/ui/components/not-found-content";

/**
 * Global not-found boundary for the web app — any URL that matches no route
 * (e.g. `/definitely-not-a-page`) renders this instead of the bare Next.js
 * default. The web app has no persistent shell (its authenticated `/hello`
 * page is full-screen), so this is the whole page: the shared presentational
 * 404 content with a Next.js "back" link.
 */
export default function WebNotFound(): React.JSX.Element {
	return (
		<NotFoundContent
			message="This page doesn't exist. Head back to the homepage or check the address you typed."
			backLink={
				<Link
					href="/"
					className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
					<ArrowLeft className="size-4" />
					Back to home
				</Link>
			}
		/>
	);
}
