import { FlagGroupFormPage } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/groups/new` — a new flag group (ADR 087). */
export default function NewFlagGroupPage(): React.JSX.Element {
	return <FlagGroupFormPage groupId={null} />;
}
