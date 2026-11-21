import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { appRoute } from "@workspace/client/lib/navigation/app-route";
import { FeatureCode } from "@/components/component-showcase/feature-code";
import type { ShowcaseDocsExample } from "@/components/component-showcase/showcase-content";
import { SHOWCASE_ROUTES } from "@/components/component-showcase/showcase-routes";

export interface ShowcaseDocsExampleBlockProps {
	readonly slug: string;
	readonly example: ShowcaseDocsExample;
}

/** An example a docs page walks through: its exact source, and a link to it running live on the component page. */
export function ShowcaseDocsExampleBlock({ slug, example }: ShowcaseDocsExampleBlockProps): React.JSX.Element {
	return (
		<figure data-showcase-docs-example={example.id} className="my-5 flex flex-col gap-2">
			<FeatureCode source={example.source} title={`${example.file}.tsx`} />
			<figcaption className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
				<span>{example.label}</span>
				<Link
					href={appRoute(SHOWCASE_ROUTES.feature(slug, example.anchor, example.part))}
					className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
					View it live
					<ArrowUpRight aria-hidden="true" className="size-3.5" />
				</Link>
			</figcaption>
		</figure>
	);
}
