import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { PostList } from "@/components/post-list";
import { pageHead } from "@/lib/seo";
import { BLOG_DESCRIPTION } from "@/lib/site";
import { fetchPosts } from "@/server/functions";

export const Route = createFileRoute("/blog/")({
	loader: () => fetchPosts(),
	head: () => pageHead({ title: "Blog", description: BLOG_DESCRIPTION, path: "/blog", breadcrumbs: [{ name: "Blog", path: "/blog" }] }),
	component: BlogPage,
});

function BlogPage(): ReactElement {
	return <PostList posts={Route.useLoaderData()} />;
}
