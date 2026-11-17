import { FlagGroupFormPage } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/groups/[id]/edit` — a flag group's name, description and conditions (ADR 087). */
export default async function EditFlagGroupPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const { id } = await params;
	return <FlagGroupFormPage groupId={id} />;
}
