import { FeatureFlagsList } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/flags` — every declared feature flag and how it is decided (ADR 087). */
export default function FeatureFlagsPage(): React.JSX.Element {
	return <FeatureFlagsList />;
}
