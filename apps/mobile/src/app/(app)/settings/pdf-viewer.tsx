// ============================================
// PDF viewer — read a PDF on the phone (features/pdf-viewer, ADR 056)
// ============================================
// The route stays light: the screen's body (features/pdf-viewer/
// pdf-viewer-screen-body.tsx — the viewer, its native module and the document
// picker) is loaded lazily the first time the screen opens
// (docs/architecture/ddd-cqrs-migration-plan.md §19.5). Until then a skeleton
// of the "Open a PDF" card holds its place.

import { Skeleton, SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import * as React from "react";

import { Screen } from "../../../components/screen";
import { PDF_VIEWER_COPY } from "../../../features/pdf-viewer/labels";
import { lazyView } from "../../../lib/lazy-view";

function PdfViewerScreenSkeleton(): React.JSX.Element {
	return (
		<Screen description={PDF_VIEWER_COPY.description} testID="pdf-viewer-loading">
			<SkeletonGroup accessibilityLabel={PDF_VIEWER_COPY.loading} testID="pdf-viewer-skeleton" className="gap-3 rounded-xl bg-card p-4">
				<SkeletonText size="lg" widthClassName="w-1/2" />
				<SkeletonText size="sm" widthClassName="w-5/6" />
				<Skeleton className="h-12 w-full rounded-lg" />
				<Skeleton className="h-12 w-full rounded-lg" />
			</SkeletonGroup>
		</Screen>
	);
}

/** The screen's body — the viewer, its native module and the document picker — loads the first time the screen opens. */
const PdfViewerScreenBody = lazyView(
	async (): Promise<React.ComponentType> => (await import("../../../features/pdf-viewer/pdf-viewer-screen-body")).PdfViewerScreenBody,
	PdfViewerScreenSkeleton,
);

export default function PdfViewerScreen(): React.JSX.Element {
	return <PdfViewerScreenBody />;
}
