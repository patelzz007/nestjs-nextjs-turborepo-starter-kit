import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { ArticlePage } from "@/components/article-page";
import { postHref } from "@/lib/blog";
import { pageHead } from "@/lib/seo";
import { fetchPost } from "@/server/functions";

export const Route = createFileRoute("/blog/$")({
	loader: ({ params }) => fetchPost({ data: { id: params._splat ?? "" } }),
	head: ({ loaderData }) =>
		loaderData === undefined
			? { meta: [] }
			: pageHead({
					title: loaderData.title,
					description: loaderData.description ?? "",
					path: postHref(loaderData.id),
					image: loaderData.coverImage,
					type: "article",
					breadcrumbs: [
						{ name: "Blog", path: "/blog" },
						{ name: loaderData.title, path: postHref(loaderData.id) },
					],
				}),
	component: PostRoute,
});

function PostRoute(): ReactElement {
	const page = Route.useLoaderData();
	return <ArticlePage key={page.id} page={page} />;
}
