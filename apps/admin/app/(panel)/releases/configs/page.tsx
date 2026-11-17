import { DynamicConfigsList } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/configs` — every declared dynamic config and its live values (ADR 087). */
export default function DynamicConfigsPage(): React.JSX.Element {
	return <DynamicConfigsList />;
}
