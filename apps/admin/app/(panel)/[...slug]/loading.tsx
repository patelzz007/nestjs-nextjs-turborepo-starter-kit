import { PanelNotFoundSkeleton } from "@/components/loading/panel-skeletons";

/**
 * An unknown panel URL while it resolves — shaped like the 404 it renders (`AdminNotFoundContent`).
 */
export default function PanelCatchAllLoading(): React.JSX.Element {
	return <PanelNotFoundSkeleton />;
}
