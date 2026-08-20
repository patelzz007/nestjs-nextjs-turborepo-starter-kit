import { EmailTemplateKeySchema } from "@workspace/shared";

import { createServerCaller } from "@workspace/client/lib/api/server-api";

import EmailPreviewView from "./email-templates";

export const dynamic = "force-dynamic";

/**
 * `/emails` — prefetches the template list server-side PLUS the first
 * template's rendered preview. The view auto-selects `templates[0]` on mount
 * (its `effectiveKey` falls back to the first list entry), so prefetching the
 * same key here means the iframe + HTML tabs render in the initial SSR HTML
 * instead of a second client round-trip.
 */
export default async function EmailPreviewPage(): Promise<React.JSX.Element> {
	const server = createServerCaller();

	const listData = await server.email.previewList.query(undefined);

	// `z.enum` guarantees a non-empty options tuple at runtime, so the guard
	// never drops the detail spec — it just keeps TS (`noUncheckedIndexedAccess`)
	// happy without a cast or a duplicated literal.
	const firstKey: string | undefined = EmailTemplateKeySchema.options[0];
	const detailData = firstKey !== undefined ? await server.email.previewDetail.query({ key: firstKey }) : undefined;

	return <EmailPreviewView initialList={listData} initialDetail={detailData} />;
}
