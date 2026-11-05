import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@workspace/ui/components/button";
import { NotFoundContent } from "@workspace/ui/components/not-found-content";
import { BookOpen, Search } from "lucide-react";
import type { ReactElement } from "react";

import { useOpenSearch } from "./search-provider";

/** 404: the shared not-found content, with the guides and search as the ways back. */
export function NotFoundPage(): ReactElement {
	const openSearch = useOpenSearch();
	return (
		<main id="main-content" className="mx-auto grid max-w-10xl place-items-center px-4 py-20 md:px-6">
			<NotFoundContent
				code="404"
				title="This page doesn't exist"
				message="It may have moved when the guides were reorganised. Browse the guides or search for it."
				backLink={
					<div className="flex flex-wrap justify-center gap-3">
						<Link to="/docs" className={buttonVariants({ variant: "default" })}>
							<BookOpen aria-hidden="true" />
							Browse all guides
						</Link>
						<button type="button" onClick={openSearch} className={buttonVariants({ variant: "outline" })}>
							<Search aria-hidden="true" />
							Search
						</button>
					</div>
				}
			/>
		</main>
	);
}
