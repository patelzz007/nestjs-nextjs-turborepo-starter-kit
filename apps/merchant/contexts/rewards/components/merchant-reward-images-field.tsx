"use client";

import { takeRewardImage } from "@/contexts/rewards/lib/reward-image-intake";
import { REWARD_IMAGE_FILE_RULES, REWARD_IMAGE_RULES, useUploadRewardImage, type UploadedRewardImage } from "@/contexts/rewards/lib/use-upload-reward-image";
import type { ImageCropSource } from "@workspace/client/lib/storage/image-crop-dialog";
import ImageCropDialogClientOnly from "@workspace/client/lib/storage/image-crop-dialog.client-only";
import { MAX_REWARD_IMAGES } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { CoverImage, type CoverImageSource } from "@workspace/ui/components/cover-image";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import * as React from "react";

/** What the merchant is told about the photos, once — the limits come from the shared upload policy. */
export const REWARD_IMAGES_GUIDANCE = `Up to ${String(MAX_REWARD_IMAGES)} landscape photos. The first is the cover on every reward card. Each is cropped to 16:9 and must be at least ${String(REWARD_IMAGE_RULES.minWidth)} × ${String(REWARD_IMAGE_RULES.minHeight)} pixels; JPEG, PNG, WebP or AVIF.`;

type ImageItem =
	| { readonly key: string; readonly kind: "ready"; readonly fileId: string; readonly url: string; readonly sources: readonly CoverImageSource[] }
	| { readonly key: string; readonly kind: "uploading"; readonly localUrl: string };

/** A saved image: an uploaded one plus the renditions the API made of it. */
export interface SavedRewardImage extends UploadedRewardImage {
	readonly sources: readonly CoverImageSource[];
}

/** The crop step's explanation: the shape, the minimum, and that zooming all the way out keeps the whole photo. */
const CROP_DESCRIPTION =
	"Every reward photo is landscape (16:9) and at least Full HD, so it stays sharp on every screen. Drag the photo or use the sliders to choose what shows. Zoom all the way out to show the whole photo, with a soft blur of it filling the space around it.";

/** Tiles are a third of the form column on wide screens, half on tablets, the full width on phones. */
const TILE_SIZES = "(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw";

export interface MerchantRewardImagesFieldProps {
	/** The organization the images are uploaded to — `undefined` while it loads (adding waits for it). */
	readonly organizationId: string | undefined;
	/** The saved images in display order (editing), with their renditions, or none for a new reward. */
	readonly initialImages: readonly SavedRewardImage[];
	/** The ready images changed (added, removed, reordered): the form saves their ids, in order; the first is the cover. */
	readonly onImagesChange: (images: readonly SavedRewardImage[]) => void;
	/** The form's validation message for the images (e.g. "Add at least one image"). */
	readonly errorMessage?: string | undefined;
	readonly disabled?: boolean;
}

interface ImageTileProps {
	readonly item: ImageItem;
	readonly index: number;
	readonly total: number;
	readonly disabled: boolean;
	readonly onMove: (index: number, offset: number) => void;
	readonly onRemove: (key: string) => void;
}

/** Shared look of the small controls laid over a photo. */
const TILE_CONTROL = "size-8 border-0 bg-background/85 text-foreground shadow-sm backdrop-blur-sm hover:bg-background";

function ImageTile({ item, index, total, disabled, onMove, onRemove }: ImageTileProps): React.JSX.Element {
	const position = index + 1;
	const handleEarlier = React.useCallback((): void => {
		onMove(index, -1);
	}, [index, onMove]);
	const handleLater = React.useCallback((): void => {
		onMove(index, 1);
	}, [index, onMove]);
	const handleRemove = React.useCallback((): void => {
		onRemove(item.key);
	}, [item.key, onRemove]);

	return (
		<li className="relative" data-slot="reward-image-tile">
			<CoverImage
				src={item.kind === "ready" ? item.url : item.localUrl}
				sources={item.kind === "ready" ? item.sources : undefined}
				sizes={TILE_SIZES}
				alt={`Photo ${String(position)} of ${String(total)}`}
				className="rounded-lg border border-border"
			/>
			{index === 0 ? <Badge className="absolute start-2 top-2 shadow-sm">Cover</Badge> : null}
			{item.kind === "uploading" ? (
				<div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-background/70 text-sm font-medium text-foreground backdrop-blur-[2px]">
					<Spinner className="size-4" aria-hidden="true" />
					Uploading…
				</div>
			) : (
				<div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
					<div className="flex gap-1">
						{/* Only the moves that can happen: the cover cannot go earlier, the last photo cannot go later. */}
						{index === 0 ? null : (
							<Button
								type="button"
								variant="outline"
								size="icon-sm"
								className={TILE_CONTROL}
								disabled={disabled}
								onClick={handleEarlier}
								aria-label={`Move photo ${String(position)} earlier`}>
								<ChevronLeft aria-hidden="true" />
							</Button>
						)}
						{index === total - 1 ? null : (
							<Button
								type="button"
								variant="outline"
								size="icon-sm"
								className={TILE_CONTROL}
								disabled={disabled}
								onClick={handleLater}
								aria-label={`Move photo ${String(position)} later`}>
								<ChevronRight aria-hidden="true" />
							</Button>
						)}
					</div>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						className={TILE_CONTROL}
						disabled={disabled}
						onClick={handleRemove}
						aria-label={`Remove photo ${String(position)}`}>
						<X aria-hidden="true" />
					</Button>
				</div>
			)}
		</li>
	);
}

function readyImagesOf(items: readonly ImageItem[]): readonly SavedRewardImage[] {
	return items.flatMap((item): SavedRewardImage[] => (item.kind === "ready" ? [{ fileId: item.fileId, url: item.url, sources: item.sources }] : []));
}

/**
 * The reward's photos: add several at once (picked or dropped), crop any that
 * are not 16:9, see each at once while it uploads and is checked, reorder them
 * (the first is the cover) and remove them. Uploading never changes the reward
 * by itself — the form saves the ordered `imageFileIds`. Renders only the
 * field's body: the editor section around it carries the visible heading.
 */
export function MerchantRewardImagesField({
	organizationId,
	initialImages,
	onImagesChange,
	errorMessage,
	disabled = false,
}: MerchantRewardImagesFieldProps): React.JSX.Element {
	const inputId = React.useId();
	const messageId = React.useId();
	const inputRef = React.useRef<HTMLInputElement>(null);
	const [items, setItems] = React.useState<readonly ImageItem[]>(() =>
		initialImages.map((image) => ({ key: image.fileId, kind: "ready", fileId: image.fileId, url: image.url, sources: image.sources })),
	);
	const [cropQueue, setCropQueue] = React.useState<readonly ImageCropSource[]>([]);
	const [readingCount, setReadingCount] = React.useState(0);
	const [notices, setNotices] = React.useState<readonly string[]>([]);
	const [isDragging, setIsDragging] = React.useState(false);
	const upload = useUploadRewardImage();
	const { mutateAsync } = upload;

	const taken = items.length + cropQueue.length + readingCount;
	const freeSlots = Math.max(0, MAX_REWARD_IMAGES - taken);
	const canAdd = !disabled && organizationId !== undefined && freeSlots > 0;
	const isUploading = items.some((item) => item.kind === "uploading");
	const message = errorMessage ?? null;
	const [currentCrop = null] = cropQueue;
	// How many more photos wait for a crop after the one in the dialog.
	const waitingAfterThis = Math.max(0, cropQueue.length - 1);

	// The form hears about every change of the ready images after the first render (the saved images are already its value).
	const readyImages = React.useMemo((): readonly SavedRewardImage[] => readyImagesOf(items), [items]);
	const readyKey = readyImages.map((image) => image.fileId).join(",");
	const notifiedKey = React.useRef(readyKey);
	React.useEffect((): void => {
		if (readyKey !== notifiedKey.current) {
			notifiedKey.current = readyKey;
			onImagesChange(readyImages);
		}
	}, [onImagesChange, readyImages, readyKey]);

	const addNotice = React.useCallback((notice: string): void => {
		setNotices((current) => [...current, notice]);
	}, []);

	const startUpload = React.useCallback(
		(file: File): void => {
			if (organizationId === undefined) {
				return;
			}
			const key = crypto.randomUUID();
			const localUrl = URL.createObjectURL(file);
			setItems((current) => [...current, { key, kind: "uploading", localUrl }]);
			const run = async (): Promise<void> => {
				try {
					const image = await mutateAsync({ organizationId, file });
					setItems((current) => current.map((item) => (item.key === key ? { key, kind: "ready", fileId: image.fileId, url: image.url, sources: [] } : item)));
				} catch (error) {
					setItems((current) => current.filter((item) => item.key !== key));
					addNotice(`${file.name}: ${error instanceof Error ? error.message : "The upload failed. Try again."}`);
				} finally {
					URL.revokeObjectURL(localUrl);
				}
			};
			void run();
		},
		[addNotice, mutateAsync, organizationId],
	);

	const addFiles = React.useCallback(
		(files: readonly File[]): void => {
			if (!canAdd || files.length === 0) {
				return;
			}
			setNotices([]);
			const accepted = files.slice(0, freeSlots);
			if (files.length > accepted.length) {
				addNotice(`A reward can have up to ${String(MAX_REWARD_IMAGES)} photos, so ${String(files.length - accepted.length)} of them were not added.`);
			}
			setReadingCount((count) => count + accepted.length);
			for (const file of accepted) {
				void takeRewardImage(file)
					.then((intake): void => {
						if (intake.kind === "refused") {
							addNotice(`${intake.fileName}: ${intake.message}`);
						} else if (intake.kind === "prepared") {
							startUpload(intake.file);
						} else {
							setCropQueue((queue) => [...queue, { id: crypto.randomUUID(), file: intake.source, image: intake.image, previewUrl: URL.createObjectURL(intake.source) }]);
						}
					})
					.finally((): void => {
						setReadingCount((count) => count - 1);
					});
			}
		},
		[addNotice, canAdd, freeSlots, startUpload],
	);

	const finishCrop = React.useCallback((): void => {
		currentCrop?.image.close();
		if (currentCrop !== null) {
			URL.revokeObjectURL(currentCrop.previewUrl);
		}
		setCropQueue(([, ...rest]) => rest);
	}, [currentCrop]);

	const handleCropped = React.useCallback(
		(file: File): void => {
			finishCrop();
			startUpload(file);
		},
		[finishCrop, startUpload],
	);

	const handleMove = React.useCallback((index: number, offset: number): void => {
		setItems((current) => {
			const target = index + offset;
			const moving = current.at(index);
			const other = current.at(target);
			if (moving === undefined || other === undefined || target < 0) {
				return current;
			}
			return current.map((item, position) => (position === index ? other : position === target ? moving : item));
		});
	}, []);

	const handleRemove = React.useCallback((key: string): void => {
		setItems((current) => current.filter((item) => item.key !== key));
	}, []);

	const handleInputChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const files = [...(event.target.files ?? [])];
			// Clear the input so choosing the same files again still triggers a change.
			event.target.value = "";
			addFiles(files);
		},
		[addFiles],
	);

	const openPicker = React.useCallback((): void => {
		inputRef.current?.click();
	}, []);

	const handleDragOver = React.useCallback(
		(event: React.DragEvent<HTMLElement>): void => {
			if (canAdd) {
				event.preventDefault();
				setIsDragging(true);
			}
		},
		[canAdd],
	);

	const handleDragLeave = React.useCallback((): void => {
		setIsDragging(false);
	}, []);

	const handleDrop = React.useCallback(
		(event: React.DragEvent<HTMLElement>): void => {
			event.preventDefault();
			setIsDragging(false);
			addFiles([...event.dataTransfer.files]);
		},
		[addFiles],
	);

	return (
		<div className="space-y-3">
			<label htmlFor={inputId} className="sr-only">
				Photos
			</label>
			<input
				ref={inputRef}
				id={inputId}
				type="file"
				multiple
				accept={REWARD_IMAGE_FILE_RULES.accept}
				className="sr-only"
				disabled={!canAdd}
				aria-invalid={message !== null ? true : undefined}
				aria-describedby={message !== null ? messageId : undefined}
				onChange={handleInputChange}
			/>

			<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Reward photos">
				{items.map((item, index) => (
					<ImageTile key={item.key} item={item} index={index} total={items.length} disabled={disabled} onMove={handleMove} onRemove={handleRemove} />
				))}
				{taken < MAX_REWARD_IMAGES ? (
					<li>
						<button
							type="button"
							data-slot="reward-images-dropzone"
							data-dragging={isDragging ? true : undefined}
							disabled={!canAdd}
							onClick={openPicker}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							className={cn(
								"flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
								message !== null ? "border-destructive/60" : "border-border",
								isDragging ? "border-primary bg-primary/5" : "bg-muted/40 hover:border-primary/50 hover:bg-muted/60",
							)}>
							{readingCount > 0 ? (
								<Spinner className="size-6 text-muted-foreground" aria-hidden="true" />
							) : (
								<ImagePlus className="size-6 text-muted-foreground" aria-hidden="true" />
							)}
							<span className="text-sm font-medium text-foreground">{items.length === 0 ? "Add photos" : "Add more photos"}</span>
							<span className="text-xs text-muted-foreground">Click to choose, or drop photos here</span>
							<span className="text-xs text-muted-foreground tabular-nums">{`${String(items.length)} of ${String(MAX_REWARD_IMAGES)} added`}</span>
						</button>
					</li>
				) : null}
			</ul>

			<p role="status" aria-live="polite" className="sr-only">
				{isUploading ? "Uploading photos" : null}
			</p>
			{notices.length > 0 ? (
				<ul role="alert" className="space-y-1 text-sm text-destructive">
					{notices.map((notice, index) => (
						<li key={`${String(index)}-${notice}`}>{notice}</li>
					))}
				</ul>
			) : null}
			{message !== null ? (
				<p id={messageId} role="alert" className="text-sm text-destructive">
					{message}
				</p>
			) : null}
			<ImageCropDialogClientOnly
				source={currentCrop}
				rules={REWARD_IMAGE_RULES}
				title="Crop the photo"
				description={CROP_DESCRIPTION}
				confirmLabel={waitingAfterThis > 0 ? `Use photo (${String(waitingAfterThis)} more)` : "Use photo"}
				cancelLabel="Skip this photo"
				onCropped={handleCropped}
				onSkip={finishCrop}
			/>
		</div>
	);
}
