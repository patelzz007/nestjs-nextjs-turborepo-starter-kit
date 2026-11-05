import { createFileRoute } from "@tanstack/react-router";

/** The client-side search index (`src/lib/search.ts`), built at pre-render time and fetched on first search. */
export const Route = createFileRoute("/search-index.json")({
	server: {
		handlers: {
			GET: async (): Promise<Response> => {
				const { contentStore } = await import("../server/content.server");
				return Response.json(await (await contentStore()).searchEntries());
			},
		},
	},
});
