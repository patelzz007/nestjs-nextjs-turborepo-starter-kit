import { FeatureFlagKeySchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { FeatureFlagDetailView } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/flags/[key]` — one feature flag, read-only, with its kill switch and overrides (ADR 087). */
export default async function FeatureFlagPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const key = FeatureFlagKeySchema.safeParse((await params).id);
	if (!key.success) {
		notFound();
	}
	return <FeatureFlagDetailView flagKey={key.data} />;
}
