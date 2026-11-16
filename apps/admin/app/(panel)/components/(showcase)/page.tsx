import { ShowcasePage } from "@/components/component-showcase/showcase-page";

/**
 * `/components` — the UI kit's component showcase: every primitive of
 * `@workspace/ui` by family, each running live beside the exact code that
 * renders it. Sample content only (no API call), so any signed-in admin may
 * open it: the sidebar item carries no permission, like the `/account` pages.
 */
export default function ComponentsPage(): React.JSX.Element {
	return <ShowcasePage />;
}
