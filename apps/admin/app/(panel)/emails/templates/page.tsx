import { EmailTemplateKeySchema } from "@workspace/shared";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { EMAIL_TEMPLATES_URL_STATE } from "@/lib/url-state/selection";

import EmailPreviewView from "./email-templates";

export const dynamic = "force-dynamic";

/**
 * `/emails/templates` — prefetches the template list server-side PLUS the selected
 * template preview (`?key=merchant-invite` deep-links — in-page selection,
 * so it stays in the query string; lib/url-state/selection parses it here and
 * in the client view).
 */
export default async function EmailPreviewPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const { key: requestedKey } = EMAIL_TEMPLATES_URL_STATE.parse(await searchParams);

	const listData = await server.email.previewList.query(undefined);

	const firstKey: string | undefined = EmailTemplateKeySchema.options[0];
	const effectiveKey = requestedKey ?? firstKey;
	const detailData = effectiveKey !== undefined ? await server.email.previewDetail.query({ key: effectiveKey }) : undefined;

	return <EmailPreviewView initialList={listData} initialDetail={detailData} />;
}
