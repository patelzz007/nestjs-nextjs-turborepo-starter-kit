"use client";

import { PDF_FILE_EXTENSION, PDF_MEDIA_TYPE, pdfFileName, type PdfOpenFailure } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { FileType } from "@workspace/ui/components/file-type";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { useFullscreen } from "@workspace/ui/hooks/use-fullscreen";
import { usePdfDocument, type PdfDocumentState, type PdfViewerSource } from "@workspace/ui/hooks/use-pdf-document";
import { usePdfInlineSupport } from "@workspace/ui/hooks/use-pdf-inline-support";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { Download, ExternalLink, FileWarning, FolderOpen, Maximize, Minimize } from "lucide-react";
import * as React from "react";

export type { PdfViewerSource } from "@workspace/ui/hooks/use-pdf-document";

export interface PdfViewerLabels {
	/** Accessible name of the toolbar. */
	readonly toolbar: string;
	/** The button that opens a PDF from this device. */
	readonly openFile: string;
	readonly download: string;
	readonly openInNewTab: string;
	readonly enterFullscreen: string;
	readonly exitFullscreen: string;
	/** Announced while a picked file is being checked. */
	readonly checking: string;
	/** Accessible name of the frame the pages are drawn in ("PDF: invoice.pdf"). */
	readonly frameTitle: (fileName: string) => string;
	/** Shown while no document is open. */
	readonly emptyTitle: string;
	readonly emptyDescription: string;
	/** Shown where the browser downloads PDFs instead of showing them (Android Chrome). */
	readonly inlineUnsupportedTitle: string;
	readonly inlineUnsupportedDescription: string;
	/** Shown when the document cannot be opened, above the reason. */
	readonly failureTitle: string;
	/** One reason per shared failure (`PdfOpenFailure`, @workspace/shared). */
	readonly failures: Readonly<Record<PdfOpenFailure, string>>;
}

export interface PdfViewerProps extends Omit<React.ComponentProps<"section">, "children"> {
	/** The document to show — a signed URL from the API or a picked file — or `null` for none. */
	readonly source: PdfViewerSource | null;
	/**
	 * Called with the file the person picked. When set, the toolbar (and the empty and failure
	 * states) offer "Open a PDF"; the caller decides whether to show it (controlled, like `value`).
	 */
	readonly onSourceChange?: ((source: PdfViewerSource) => void) | undefined;
	/** Per-usage override of the copy. */
	readonly labels?: UiKitLabelsOverride<"pdfViewer"> | undefined;
}

/** What the file picker accepts: the media type, and the extension for systems that type files by name. */
const PDF_FILE_ACCEPT = `${PDF_MEDIA_TYPE},${PDF_FILE_EXTENSION}`;

const TOOLBAR_ICON_CLASS = "size-4";

/**
 * Shows a PDF with the kit's own toolbar — the file's name, open-from-device, open in a new
 * tab, download and fullscreen — around the browser's built-in PDF engine, which draws the
 * pages (with its own page navigation, zoom and search). No PDF library is bundled
 * (docs/technical/frontend/pdf-viewer.md).
 *
 * A picked file is checked locally (size, `%PDF-` header) before it is shown. Where the
 * browser cannot show PDFs inline (Android Chrome), the viewer says so and offers the new
 * tab and the download instead of a blank frame. Sized by its parent: give it a height.
 */
export const PdfViewer = React.forwardRef<HTMLElement, PdfViewerProps>(function PdfViewer(
	{ source, onSourceChange, labels: labelsOverride, className, ...props },
	forwardedRef,
): React.JSX.Element {
	const labels = useUiKitLabels("pdfViewer", labelsOverride);
	const document = usePdfDocument(source);
	const inlineSupported = usePdfInlineSupport();
	const rootRef = React.useRef<HTMLElement | null>(null);
	const fullscreen = useFullscreen(rootRef);
	const fileInputRef = React.useRef<HTMLInputElement | null>(null);

	const setRootRef = React.useMemo((): React.RefCallback<HTMLElement> => mergeRefs(rootRef, forwardedRef), [forwardedRef]);

	const openFilePicker = React.useCallback((): void => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const [file] = event.currentTarget.files ?? [];
			// Cleared, so picking the same file again (after replacing it on disk) still reports a change.
			event.currentTarget.value = "";
			if (file !== undefined) {
				onSourceChange?.({ kind: "file", file });
			}
		},
		[onSourceChange],
	);

	const canOpenFile = onSourceChange !== undefined;
	const openFileButton = canOpenFile ? (
		<Button type="button" variant="outline" size="sm" onClick={openFilePicker}>
			<FolderOpen aria-hidden="true" data-icon="inline-start" className={TOOLBAR_ICON_CLASS} />
			{labels.openFile}
		</Button>
	) : null;

	return (
		<section
			ref={setRootRef}
			data-slot="pdf-viewer"
			data-status={document.status}
			aria-label={document.status === "idle" ? labels.emptyTitle : pdfFileName(document.fileName)}
			className={cn("flex min-h-96 flex-col overflow-hidden rounded-lg border border-border bg-card [&:fullscreen]:rounded-none [&:fullscreen]:border-0", className)}
			{...props}>
			<PdfViewerToolbar
				document={document}
				labels={labels}
				inlineSupported={inlineSupported}
				canOpenFile={canOpenFile}
				onOpenFile={openFilePicker}
				fullscreenSupported={fullscreen.supported}
				fullscreenActive={fullscreen.active}
				onToggleFullscreen={fullscreen.toggle}
			/>
			<div data-slot="pdf-viewer-body" className="relative flex min-h-0 flex-1 flex-col bg-muted">
				<PdfViewerBody document={document} labels={labels} inlineSupported={inlineSupported} openFileButton={openFileButton} />
			</div>
			{canOpenFile ? <input ref={fileInputRef} type="file" accept={PDF_FILE_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleFileChange} /> : null}
		</section>
	);
});

interface PdfViewerToolbarProps {
	readonly document: PdfDocumentState;
	readonly labels: PdfViewerLabels;
	readonly inlineSupported: boolean;
	readonly canOpenFile: boolean;
	readonly onOpenFile: () => void;
	readonly fullscreenSupported: boolean;
	readonly fullscreenActive: boolean;
	readonly onToggleFullscreen: () => void;
}

function PdfViewerToolbar({
	document,
	labels,
	inlineSupported,
	canOpenFile,
	onOpenFile,
	fullscreenSupported,
	fullscreenActive,
	onToggleFullscreen,
}: PdfViewerToolbarProps): React.JSX.Element {
	const ready = document.status === "ready" ? document : null;
	return (
		<div role="toolbar" aria-label={labels.toolbar} data-slot="pdf-viewer-toolbar" className="flex min-h-12 items-center gap-2 border-b border-border px-3 py-2">
			<FileType type="pdf" size="xs" aria-hidden="true" />
			<p data-slot="pdf-viewer-file-name" className="min-w-0 flex-1 truncate text-sm font-medium">
				{document.status === "idle" ? labels.emptyTitle : pdfFileName(document.fileName)}
			</p>
			<div className="flex shrink-0 items-center gap-1">
				{canOpenFile ? (
					<Button type="button" variant="ghost" size="icon-sm" aria-label={labels.openFile} onClick={onOpenFile}>
						<FolderOpen aria-hidden="true" className={TOOLBAR_ICON_CLASS} />
					</Button>
				) : null}
				{ready !== null ? (
					<>
						<a
							href={ready.viewUrl}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={labels.openInNewTab}
							className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
							<ExternalLink aria-hidden="true" className={TOOLBAR_ICON_CLASS} />
						</a>
						<a href={ready.downloadUrl} download={pdfFileName(ready.fileName)} aria-label={labels.download} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
							<Download aria-hidden="true" className={TOOLBAR_ICON_CLASS} />
						</a>
						{fullscreenSupported && inlineSupported ? (
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={fullscreenActive ? labels.exitFullscreen : labels.enterFullscreen}
								aria-pressed={fullscreenActive}
								onClick={onToggleFullscreen}>
								{fullscreenActive ? <Minimize aria-hidden="true" className={TOOLBAR_ICON_CLASS} /> : <Maximize aria-hidden="true" className={TOOLBAR_ICON_CLASS} />}
							</Button>
						) : null}
					</>
				) : null}
			</div>
		</div>
	);
}

interface PdfViewerBodyProps {
	readonly document: PdfDocumentState;
	readonly labels: PdfViewerLabels;
	readonly inlineSupported: boolean;
	readonly openFileButton: React.ReactNode;
}

function PdfViewerBody({ document, labels, inlineSupported, openFileButton }: PdfViewerBodyProps): React.JSX.Element {
	switch (document.status) {
		case "idle":
			return (
				<PdfViewerMessage icon={<FileType type="pdf" size="lg" aria-hidden="true" />} title={labels.emptyTitle} description={labels.emptyDescription}>
					{openFileButton}
				</PdfViewerMessage>
			);
		case "checking":
			return (
				<SkeletonRegion labels={{ loading: labels.checking }} className="flex flex-1 flex-col items-center gap-4 p-6">
					<PdfPageSkeleton />
				</SkeletonRegion>
			);
		case "failed":
			return (
				<PdfViewerMessage icon={<FileWarning aria-hidden="true" />} title={labels.failureTitle} description={labels.failures[document.failure]} role="alert">
					{openFileButton}
				</PdfViewerMessage>
			);
		case "ready":
			return inlineSupported ? (
				<>
					{/* Behind the frame: visible until the browser's PDF engine paints its first page over it. */}
					<div aria-hidden="true" className="absolute inset-0 flex flex-col items-center gap-4 p-6">
						<PdfPageSkeleton />
					</div>
					<iframe
						key={document.viewUrl}
						data-slot="pdf-viewer-frame"
						title={labels.frameTitle(pdfFileName(document.fileName))}
						src={document.viewUrl}
						referrerPolicy="no-referrer"
						className="relative min-h-0 w-full flex-1 border-0 bg-transparent"
					/>
				</>
			) : (
				<PdfViewerMessage icon={<FileType type="pdf" size="lg" aria-hidden="true" />} title={labels.inlineUnsupportedTitle} description={labels.inlineUnsupportedDescription}>
					<div className="flex flex-wrap justify-center gap-2">
						<a href={document.viewUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
							<ExternalLink aria-hidden="true" data-icon="inline-start" className={TOOLBAR_ICON_CLASS} />
							{labels.openInNewTab}
						</a>
						<a href={document.downloadUrl} download={pdfFileName(document.fileName)} className={buttonVariants({ size: "sm" })}>
							<Download aria-hidden="true" data-icon="inline-start" className={TOOLBAR_ICON_CLASS} />
							{labels.download}
						</a>
					</div>
				</PdfViewerMessage>
			);
	}
}

/** A page-shaped placeholder: the A4 proportions most documents use. */
function PdfPageSkeleton(): React.JSX.Element {
	return <Skeleton className="aspect-[1/1.414] w-full max-w-2xl rounded-sm" />;
}

interface PdfViewerMessageProps {
	readonly icon: React.ReactNode;
	readonly title: string;
	readonly description: string;
	readonly role?: "alert" | undefined;
	readonly children?: React.ReactNode;
}

function PdfViewerMessage({ icon, title, description, role, children }: PdfViewerMessageProps): React.JSX.Element {
	return (
		<Empty role={role} className="flex-1">
			<EmptyHeader>
				<EmptyMedia variant="icon">{icon}</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			{children === null || children === undefined ? null : <EmptyContent>{children}</EmptyContent>}
		</Empty>
	);
}
