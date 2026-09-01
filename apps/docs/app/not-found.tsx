import { Compass } from "lucide-react";
import Link from "next/link";

import { OpenSearchButton } from "@/components/open-search-button";

/** Themed 404 — search the docs or jump back to the first guide. */
export default function NotFoundPage(): React.JSX.Element {
	return (
		<div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center">
			<p className="text-fd-primary text-7xl font-bold tracking-tight">404</p>
			<div className="flex flex-col items-center gap-2">
				<h1 className="text-xl font-semibold">Page not found</h1>
				<p className="text-fd-muted-foreground max-w-md text-sm leading-6 text-balance">
					The page you&apos;re looking for doesn&apos;t exist or was moved. Search the docs, or head back to the guides.
				</p>
			</div>
			<div className="flex flex-wrap items-center justify-center gap-3">
				<OpenSearchButton label="Search the docs" />
				<Link
					href="/docs/getting-started"
					className="bg-fd-card text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium shadow-sm transition-colors">
					<Compass className="size-4" />
					Browse guides
				</Link>
			</div>
		</div>
	);
}
