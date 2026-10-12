import { EmailTemplateKeySchema } from "@workspace/shared";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PageHeaderSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type * as React from "react";

import { EMAIL_TEMPLATES_LOADING_LABELS } from "@/components/loading/loading-labels";
import { BadgeSkeleton, CardHeadingSkeleton } from "@/components/loading/skeleton-parts";

/** One index row per template the API can render. */
const EMAIL_TEMPLATE_COUNT: number = EmailTemplateKeySchema.options.length;

/** The rendered-email area of the preview card (`h-180`, the iframe's own height). */
export function EmailPreviewBodySkeleton(): React.JSX.Element {
	return <Skeleton data-skeleton="email-preview-body" className="h-180 w-full rounded-lg" />;
}

/** The selected template's label + key badge over its recipient/subject line. */
export function EmailTemplateMetaSkeleton(): React.JSX.Element {
	return (
		<div data-skeleton="email-template-meta" className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<Skeleton variant="text" className="h-5 w-48" />
				<BadgeSkeleton className="w-24" />
			</div>
			<Skeleton variant="text" className="h-3.5 w-72 max-w-full" />
		</div>
	);
}

/**
 * `/emails/templates`: header (+ template count badge), then the template
 * index card beside the preview card (meta, mode tabs, copy/send, rendered email).
 */
export function EmailTemplatesPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={EMAIL_TEMPLATES_LOADING_LABELS} className="mx-auto flex w-full flex-col gap-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<PageHeaderSkeleton />
				<BadgeSkeleton className="w-28" />
			</div>
			<div className="grid gap-6 lg:grid-cols-[280px_1fr]">
				<Card className="h-fit">
					<CardHeader className="pb-3">
						<CardHeadingSkeleton />
					</CardHeader>
					<CardContent className="flex flex-col gap-1 p-2">
						{placeholderKeys("template", EMAIL_TEMPLATE_COUNT).map((key) => (
							<div key={key} data-skeleton="email-template-row" className="flex flex-col gap-1.5 px-3 py-2">
								<Skeleton variant="text" className="h-3.5 w-3/4" />
								<Skeleton variant="text" className="h-3 w-full" />
							</div>
						))}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
						<EmailTemplateMetaSkeleton />
						<div className="flex items-center gap-2">
							<Skeleton className="h-8 w-44" />
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-8 w-36" />
						</div>
					</CardHeader>
					<CardContent className="min-h-[40vh]">
						<EmailPreviewBodySkeleton />
					</CardContent>
				</Card>
			</div>
		</SkeletonRegion>
	);
}
