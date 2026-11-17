import { PromotionImport } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/promotion` — import rules exported from another environment (rule promotion, ADR 087). */
export default function PromotionPage(): React.JSX.Element {
	return <PromotionImport />;
}
