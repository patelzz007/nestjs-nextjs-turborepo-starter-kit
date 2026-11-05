import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, type ReactElement } from "react";
import { z } from "zod";

import { SearchPage } from "@/components/search-page";
import { pageHead } from "@/lib/seo";

/** `?q=` — the search terms, so a search can be linked to. Bounded like any input. */
const SearchParamsSchema = z.object({ q: z.string().max(200).catch("") });

export const Route = createFileRoute("/search")({
	validateSearch: SearchParamsSchema,
	head: () => pageHead({ title: "Search", description: "Search every guide, heading and blog post.", path: "/search" }),
	component: SearchRoute,
});

function SearchRoute(): ReactElement {
	const { q } = Route.useSearch();
	const navigate = useNavigate({ from: "/search" });
	const onQueryChange = useCallback(
		(query: string): void => {
			void navigate({ search: { q: query }, replace: true });
		},
		[navigate],
	);
	return <SearchPage query={q} onQueryChange={onQueryChange} />;
}
