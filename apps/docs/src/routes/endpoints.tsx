import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { EndpointsExplorer } from "@/components/endpoints-explorer";
import { pageHead } from "@/lib/seo";

const DESCRIPTION = "Every API endpoint in one table: method, path, what it does and who may call it, each linked to its reference.";

export const Route = createFileRoute("/endpoints")({
	head: () => pageHead({ title: "Endpoints", description: DESCRIPTION, path: "/endpoints", breadcrumbs: [{ name: "Endpoints", path: "/endpoints" }] }),
	component: EndpointsPage,
});

function EndpointsPage(): ReactElement {
	return (
		<main id="main-content" className="mx-auto max-w-10xl px-4 pt-10 pb-20 md:px-6">
			<header className="grid max-w-3xl gap-3">
				<p className="font-mono text-xs text-muted-foreground">docs/generated/openapi.json</p>
				<h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Endpoints</h1>
				<p className="text-lg leading-relaxed text-(--docs-text-secondary)">{DESCRIPTION}</p>
			</header>
			<div className="mt-8">
				<EndpointsExplorer />
			</div>
		</main>
	);
}
