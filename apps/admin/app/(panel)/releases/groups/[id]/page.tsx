import { FlagGroupDetailView } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/groups/[id]` — one flag group, read-only, with its members (ADR 087). */
export default async function FlagGroupPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const { id } = await params;
	return <FlagGroupDetailView groupId={id} />;
}
