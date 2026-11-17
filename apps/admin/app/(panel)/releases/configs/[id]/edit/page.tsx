import { DynamicConfigKeySchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { ConfigFormPage } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/configs/[key]/edit` — a dynamic config's values and rules, saved as its next revision (ADR 087). */
export default async function EditDynamicConfigPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const key = DynamicConfigKeySchema.safeParse((await params).id);
	if (!key.success) {
		notFound();
	}
	return <ConfigFormPage configKey={key.data} />;
}
