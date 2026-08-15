import { EmailTemplateKeySchema } from "@workspace/shared";

import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import EmailPreviewView from "./email-templates";

export const dynamic = "force-dynamic";

/**
 * `/emails` — prefetches the template list server-side PLUS the first
 * template's rendered preview. The view auto-selects `templates[0]` on mount
 * (its `effectiveKey` falls back to the first list entry), so prefetching the
 * same key here means the iframe + HTML tabs render in the initial SSR HTML
 * instead of a second client round-trip. The first registry key is stable
 * (`verification`), referenced via the shared schema rather than a literal.
 */
export default async function EmailPreviewPage(): Promise<React.JSX.Element> {
	// `z.enum` guarantees a non-empty options tuple at runtime, so the guard
	// never drops the detail spec — it just keeps TS (`noUncheckedIndexedAccess`)
	// happy without a cast or a duplicated literal.
	const firstKey: string | undefined = EmailTemplateKeySchema.options[0];
	const { state, report } = await prefetchPage((server) => [
		server.email.previewList(undefined),
		...(firstKey !== undefined ? [server.email.previewDetail({ key: firstKey })] : []),
	]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<EmailPreviewView />
		</PrefetchBoundary>
	);
}
