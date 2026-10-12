import { PanelContentSkeleton } from "@/components/loading/panel-skeletons";

/**
 * Loading fallback for every authenticated panel route without a skeleton of its own. Shown while the page
 * segment streams in — since the `(panel)` layout keeps the sidebar/topbar mounted, this replaces only the
 * content area, so navigation stays SPA-like.
 */
export default function PanelLoading(): React.JSX.Element {
	return <PanelContentSkeleton />;
}
