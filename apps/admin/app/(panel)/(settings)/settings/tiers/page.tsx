import { TierSettingsView } from "@/contexts/tiers";

export const dynamic = "force-dynamic";

/** `/settings/tiers` — the customer tier rules (ADR 085). Gated by READ SYSTEM_SETTINGS and the customer-tiers flag. */
export default function TierSettingsPage(): React.JSX.Element {
	return <TierSettingsView />;
}
