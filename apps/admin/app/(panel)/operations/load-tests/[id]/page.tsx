import { UuidParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { LoadTestDetail } from "@/contexts/operations/components/load-test-detail";

export const dynamic = "force-dynamic";

/** `/operations/load-tests/[id]` — one load test, live while it runs (ADR 068). */
export default async function OperationsLoadTestPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const parsed = UuidParamSchema.safeParse((await params).id);
	if (!parsed.success) {
		notFound();
	}
	return <LoadTestDetail runId={parsed.data} />;
}
