import { FeatureFlagsView } from "@/contexts/feature-flags";

export const dynamic = "force-dynamic";

/** `/settings/feature-flags` — the runtime feature flags and their settings (enhancement 5.6). */
export default function FeatureFlagsPage(): React.JSX.Element {
	return <FeatureFlagsView />;
}
