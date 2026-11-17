import { FeatureFlagKeySchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { FlagRulesFormPage } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/flags/[key]/edit` — a feature flag's rules, saved as its next revision (ADR 087). */
export default async function EditFeatureFlagPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const key = FeatureFlagKeySchema.safeParse((await params).id);
	if (!key.success) {
		notFound();
	}
	return <FlagRulesFormPage flagKey={key.data} />;
}
