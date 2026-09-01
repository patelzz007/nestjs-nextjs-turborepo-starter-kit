import { EmailTemplateKeySchema } from "@workspace/shared";

import { createAdminServerCaller } from "@/lib/admin-server-api";

import EmailPreviewView from "./email-templates";

export const dynamic = "force-dynamic";

function parseTemplateKey(value: string | string[] | undefined): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const parsed = EmailTemplateKeySchema.safeParse(value);
	return parsed.success ? parsed.data : undefined;
}

/**
 * `/emails` — prefetches the template list server-side PLUS the selected
 * template preview (`?key=merchant-invite` deep-links).
 */
export default async function EmailPreviewPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const params = await searchParams;
	const requestedKey = parseTemplateKey(params.key);

	const listData = await server.email.previewList.query(undefined);

	const firstKey: string | undefined = EmailTemplateKeySchema.options[0];
	const effectiveKey = requestedKey ?? firstKey;
	const detailData = effectiveKey !== undefined ? await server.email.previewDetail.query({ key: effectiveKey }) : undefined;

	return <EmailPreviewView initialList={listData} initialDetail={detailData} initialSelectedKey={requestedKey} />;
}
