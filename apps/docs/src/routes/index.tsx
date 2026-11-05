import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { LearningCenterView } from "@/components/learning-center";
import { pageHead } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";
import { fetchLearningCenter } from "@/server/functions";

export const Route = createFileRoute("/")({
	loader: () => fetchLearningCenter(),
	head: () => pageHead({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: "/" }),
	component: HomePage,
});

function HomePage(): ReactElement {
	return <LearningCenterView center={Route.useLoaderData()} />;
}
