"use client";

import type { RewardImageResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { ImageCarousel, type ImageCarouselImage } from "@workspace/ui/components/image-carousel";
import { Spinner } from "@workspace/ui/components/spinner";
import { Download, FolderDown, Maximize2 } from "lucide-react";
import * as React from "react";

import { useRewardImageDownload } from "@/contexts/rewards/lib/use-reward-image-download";

/** How wide the page draws the photos: the wider of the two columns at `lg` (3/5 of a 72rem page), else the full width. */
const PAGE_IMAGE_SIZES = "(min-width: 64rem) 42rem, 100vw";
/** How wide the viewer draws them: its dialog is at most 64rem, less its padding. */
const VIEWER_IMAGE_SIZES = "(min-width: 64rem) 62rem, 100vw";

export interface RewardReviewImagesProps {
	readonly rewardId: string;
	readonly title: string;
	readonly images: readonly RewardImageResponse[];
}

function toCarouselImages(images: readonly RewardImageResponse[]): ImageCarouselImage[] {
	return images.map((image) => ({ id: image.fileId, src: image.url, sources: image.sources }));
}

function photoCountLabel(total: number): string {
	return total === 1 ? "1 photo" : `${String(total)} photos`;
}

interface PhotoDownloadButtonProps {
	readonly accessibleName: string;
	readonly label: string;
	readonly isPending: boolean;
	readonly onDownload: () => void;
	readonly variant: "outline" | "default";
}

/** Saves the shown photo's original upload. */
function PhotoDownloadButton({ accessibleName, label, isPending, onDownload, variant }: PhotoDownloadButtonProps): React.JSX.Element {
	return (
		<Button type="button" size="sm" variant={variant} disabled={isPending} aria-label={accessibleName} onClick={onDownload}>
			{isPending ? <Spinner className="size-4" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
			{label}
		</Button>
	);
}

interface DownloadAllButtonProps {
	readonly total: number;
	readonly title: string;
	readonly isPending: boolean;
	readonly onDownloadAll: () => void;
}

/** Saves every photo at once: one ZIP of the original uploads, built by the API. */
function DownloadAllButton({ total, title, isPending, onDownloadAll }: DownloadAllButtonProps): React.JSX.Element {
	return (
		<Button
			type="button"
			size="sm"
			variant="outline"
			disabled={isPending}
			aria-label={`Download all ${String(total)} photos of ${title} as a ZIP file`}
			onClick={onDownloadAll}>
			{isPending ? <Spinner className="size-4" aria-hidden="true" /> : <FolderDown className="size-4" aria-hidden="true" />}
			Download all
		</Button>
	);
}

/**
 * The reward's photos, which reviewers moderate along with the copy: a swipeable
 * carousel on the page, a full-size carousel in a dialog (opened on the photo
 * the page shows), and a download of the shown photo's original upload from
 * either — or, with several photos, of all of them at once as one ZIP.
 * The photos are decorative — the title heads the page and names every control.
 */
export function RewardReviewImages({ rewardId, title, images }: RewardReviewImagesProps): React.JSX.Element | null {
	const { download, pendingFileId, downloadAll, isArchivePending } = useRewardImageDownload();
	const [selected, setSelected] = React.useState(0);
	const [isViewerOpen, setIsViewerOpen] = React.useState(false);
	// The page's carousel starts on whatever photo the viewer was left on.
	const [pageCarouselKey, setPageCarouselKey] = React.useState(0);
	const carouselImages = React.useMemo(() => toCarouselImages(images), [images]);
	const total = images.length;
	const current = images.at(Math.min(selected, total - 1));
	const currentFileId = current?.fileId;

	const handleDownloadCurrent = React.useCallback((): void => {
		if (currentFileId !== undefined) {
			download(rewardId, currentFileId);
		}
	}, [currentFileId, download, rewardId]);

	const handleDownloadAll = React.useCallback((): void => {
		downloadAll(rewardId);
	}, [downloadAll, rewardId]);

	const handleOpenViewer = React.useCallback((): void => {
		setIsViewerOpen(true);
	}, []);

	const handleViewerOpenChange = React.useCallback((open: boolean): void => {
		setIsViewerOpen(open);
		if (!open) {
			setPageCarouselKey((key) => key + 1);
		}
	}, []);

	if (current === undefined) {
		return null;
	}
	const position = `photo ${String(selected + 1)} of ${String(total)}`;
	const hasSeveral = total > 1;
	const isCurrentPending = pendingFileId === current.fileId;

	return (
		<div className="min-w-0 space-y-3">
			<ImageCarousel
				key={pageCarouselKey}
				images={carouselImages}
				startIndex={selected}
				onSelectedIndexChange={setSelected}
				sizes={PAGE_IMAGE_SIZES}
				priority
				frameClassName="rounded-lg border"
			/>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-sm text-muted-foreground">
					{photoCountLabel(total)}, {String(current.width)} × {String(current.height)} pixels
				</p>
				<div className="flex flex-wrap gap-2">
					<Button type="button" size="sm" variant="outline" aria-label={`View the photos of ${title} full size`} onClick={handleOpenViewer}>
						<Maximize2 className="size-4" aria-hidden="true" />
						View full size
					</Button>
					<PhotoDownloadButton
						accessibleName={`Download ${position} of ${title}`}
						label="Download"
						isPending={isCurrentPending}
						onDownload={handleDownloadCurrent}
						variant="outline"
					/>
					{hasSeveral ? <DownloadAllButton total={total} title={title} isPending={isArchivePending} onDownloadAll={handleDownloadAll} /> : null}
				</div>
			</div>

			<Dialog open={isViewerOpen} onOpenChange={handleViewerOpenChange}>
				<DialogContent className="gap-4 sm:max-w-5xl">
					<DialogHeader>
						<DialogTitle className="pe-8">{title}</DialogTitle>
						<DialogDescription>
							{total === 1 ? "1 photo" : `Photo ${String(selected + 1)} of ${String(total)}`}, uploaded at {String(current.width)} × {String(current.height)} pixels.
						</DialogDescription>
					</DialogHeader>
					{isViewerOpen ? (
						<ImageCarousel images={carouselImages} startIndex={selected} onSelectedIndexChange={setSelected} sizes={VIEWER_IMAGE_SIZES} priority frameClassName="rounded-lg" />
					) : null}
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
						{hasSeveral ? <DownloadAllButton total={total} title={title} isPending={isArchivePending} onDownloadAll={handleDownloadAll} /> : null}
						<PhotoDownloadButton
							accessibleName={`Download ${position} of ${title}`}
							label={total === 1 ? "Download photo" : `Download photo ${String(selected + 1)}`}
							isPending={isCurrentPending}
							onDownload={handleDownloadCurrent}
							variant="default"
						/>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
