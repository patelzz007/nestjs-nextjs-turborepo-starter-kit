import { EmailTemplateKeySchema } from "@workspace/shared";

import { createAdminServerCaller } from "@/lib/admin-server-api";

import EmailPreviewView from "../../emails/email-templates";

export const dynamic = "force-dynamic";

/** `/admin/email-template` — same email template browser as Settings → Email Templates. */
export default async function AdminEmailTemplatePage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();

	const listData = await server.email.previewList.query(undefined);

	const firstKey: string | undefined = EmailTemplateKeySchema.options[0];
	const detailData = firstKey !== undefined ? await server.email.previewDetail.query({ key: firstKey }) : undefined;

	return <EmailPreviewView initialList={listData} initialDetail={detailData} />;
}
