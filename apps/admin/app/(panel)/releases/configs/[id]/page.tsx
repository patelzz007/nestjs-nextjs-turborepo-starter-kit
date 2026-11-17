import { DynamicConfigKeySchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { DynamicConfigDetailView } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/configs/[key]` — one dynamic config, read-only: values, rules, exposures, history (ADR 087). */
export default async function DynamicConfigPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const key = DynamicConfigKeySchema.safeParse((await params).id);
	if (!key.success) {
		notFound();
	}
	return <DynamicConfigDetailView configKey={key.data} />;
}
