import { FlagGroupsList } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/groups` — flag groups that rules can name (ADR 087). */
export default function FlagGroupsPage(): React.JSX.Element {
	return <FlagGroupsList />;
}
