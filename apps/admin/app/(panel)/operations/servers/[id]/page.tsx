import { UuidParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { ServerDetail } from "@/contexts/operations/components/server-detail";

export const dynamic = "force-dynamic";

/** `/operations/servers/[id]` — one server: facts, live numbers and history (ADR 068). */
export default async function OperationsServerPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const parsed = UuidParamSchema.safeParse((await params).id);
	if (!parsed.success) {
		notFound();
	}
	return <ServerDetail serverId={parsed.data} />;
}
