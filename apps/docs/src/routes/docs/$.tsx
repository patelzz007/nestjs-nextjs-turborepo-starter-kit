import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { ArticlePage } from "@/components/article-page";
import { NavTree } from "@/components/nav-tree";
import { docHref } from "@/lib/navigation";
import { pageHead } from "@/lib/seo";
import { SITE_DESCRIPTION } from "@/lib/site";
import { fetchGuide } from "@/server/functions";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/docs/$")({
	loader: ({ params }) => fetchGuide({ data: { id: params._splat ?? "" } }),
	head: ({ loaderData }) =>
		loaderData === undefined
			? { meta: [] }
			: pageHead({
					title: loaderData.title,
					description: loaderData.description ?? SITE_DESCRIPTION,
					path: docHref(loaderData.id),
					image: loaderData.coverImage,
					type: "article",
					breadcrumbs: [
						{ name: "Guides", path: "/docs" },
						...(loaderData.section === null ? [] : [{ name: loaderData.section, path: "/docs" }]),
						{ name: loaderData.title, path: docHref(loaderData.id) },
					],
				}),
	component: GuideRoute,
});

function GuideRoute(): ReactElement {
	const page = Route.useLoaderData();
	const sections = RootRoute.useLoaderData();
	return <ArticlePage key={page.id} page={page} sidebar={<NavTree sections={sections} activeId={page.id} />} />;
}
