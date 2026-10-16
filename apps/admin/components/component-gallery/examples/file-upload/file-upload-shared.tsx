"use client";

// ── Building blocks shared by the FileUpload examples ───────────────────────
// `useFileUpload` only PICKS and validates files in the browser: nothing in
// these examples uploads anything (rules/20-object-storage.md — a real feature
// sends picked files through the presigned multipart storage flow, and the
// server re-validates size and type). Where an example shows a progress bar,
// the progress comes from `useSimulatedTransfers`, a deterministic timer that
// stands in for the storage flow's progress events and never touches a file.

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import type { FileMetadata, FileUploadActions, FileWithPreview } from "@workspace/ui/hooks/use-file-upload";
import { cn } from "@workspace/ui/lib/core/utils";
import { CircleAlertIcon, FileArchiveIcon, FileSpreadsheetIcon, FileTextIcon, HeadphonesIcon, ImageIcon, VideoIcon, type LucideIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";

// ── Sizes ───────────────────────────────────────────────────────────────────

/** Bytes in one binary megabyte (MiB), for `maxSize` limits. */
export const BYTES_PER_MEGABYTE = 1024 * 1024;

// ── Sample images ───────────────────────────────────────────────────────────
// Served from Unsplash's CDN, the image host the admin already allows
// (`next.config.ts` → `images.remotePatterns`).

/** Unsplash photo ids used as already-stored sample images. */
export const SAMPLE_PHOTO_IDS: readonly string[] = [
	"photo-1486312338219-ce68d2c6f44d",
	"photo-1461749280684-dccba630e2f6",
	"photo-1451187580459-43490279c0fa",
	"photo-1504384308090-c894fdcc538d",
	"photo-1541701494587-cb58502866ab",
	"photo-1579546929518-9e396f3cc809",
];

/** Width and height requested from the image CDN for sample photos, in pixels. */
const SAMPLE_PHOTO_WIDTH_PX = 1000;
const SAMPLE_PHOTO_HEIGHT_PX = 800;
/** JPEG quality requested from the image CDN. */
const SAMPLE_PHOTO_QUALITY = 80;

/** The CDN URL of one sample photo, in greyscale like the original examples. */
export function samplePhotoUrl(photoId: string): string {
	return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&sat=-100&w=${String(SAMPLE_PHOTO_WIDTH_PX)}&h=${String(SAMPLE_PHOTO_HEIGHT_PX)}&q=${String(SAMPLE_PHOTO_QUALITY)}`;
}

/** Sample photos are numbered from one for people. */
const FIRST_SAMPLE_NUMBER = 1;
/** Byte size shown for every sample photo (they are not real files). */
const SAMPLE_PHOTO_SIZE_BYTES = 48_210;

/** The first `count` sample photos as already-stored files (`initialFiles`). */
export function sampleImageFiles(count: number, idPrefix: string): readonly FileMetadata[] {
	return SAMPLE_PHOTO_IDS.slice(0, count).map((photoId: string, index: number): FileMetadata => ({
		id: `${idPrefix}-${String(index + FIRST_SAMPLE_NUMBER)}`,
		name: `image-${String(index + FIRST_SAMPLE_NUMBER)}.jpg`,
		size: SAMPLE_PHOTO_SIZE_BYTES,
		type: "image/jpeg",
		url: samplePhotoUrl(photoId),
	}));
}

/**
 * Sample metadata has no stored copy behind it: the examples never link to or
 * fetch a document, so its `url` stays empty.
 */
const NO_STORED_URL = "";

/** Already-stored sample documents, for the list, table and card examples. */
export const SAMPLE_DOCUMENT_FILES: readonly FileMetadata[] = [
	{ id: "sample-doc-report", name: "document.pdf", size: 529_254, type: "application/pdf", url: NO_STORED_URL },
	{ id: "sample-doc-archive", name: "intro.zip", size: 252_846, type: "application/zip", url: NO_STORED_URL },
	{ id: "sample-doc-sheet", name: "conclusion.xlsx", size: 353_126, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", url: NO_STORED_URL },
	{ id: "sample-doc-manifest", name: "package.json", size: 697, type: "application/json", url: NO_STORED_URL },
];

/** The sample document shown as a failed earlier attempt, so the retry affordance is visible. */
export const FAILED_SAMPLE_FILE_ID = "sample-doc-archive";

// ── File kinds ──────────────────────────────────────────────────────────────

const IMAGE_MIME_PREFIX = "image/";

/** Whether a picked or stored file is an image (so it can show a thumbnail). */
export function isImageFile(file: File | FileMetadata): boolean {
	return file.type.startsWith(IMAGE_MIME_PREFIX);
}

/** One recognisable family of files, with its icon and a short label. */
interface FileKind {
	readonly label: string;
	readonly icon: LucideIcon;
	/** Whether a MIME type belongs to this family. */
	readonly matches: (mimeType: string) => boolean;
}

/** Families in match order; the first match wins. */
const FILE_KINDS: readonly FileKind[] = [
	{ label: "Image", icon: ImageIcon, matches: (mimeType: string): boolean => mimeType.startsWith(IMAGE_MIME_PREFIX) },
	{ label: "Video", icon: VideoIcon, matches: (mimeType: string): boolean => mimeType.startsWith("video/") },
	{ label: "Audio", icon: HeadphonesIcon, matches: (mimeType: string): boolean => mimeType.startsWith("audio/") },
	{ label: "PDF", icon: FileTextIcon, matches: (mimeType: string): boolean => mimeType.includes("pdf") },
	{ label: "Word", icon: FileTextIcon, matches: (mimeType: string): boolean => mimeType.includes("word") || mimeType.includes("doc") },
	{ label: "Excel", icon: FileSpreadsheetIcon, matches: (mimeType: string): boolean => mimeType.includes("excel") || mimeType.includes("sheet") },
	{ label: "Archive", icon: FileArchiveIcon, matches: (mimeType: string): boolean => mimeType.includes("zip") || mimeType.includes("rar") },
	{ label: "JSON", icon: FileTextIcon, matches: (mimeType: string): boolean => mimeType.includes("json") },
	{ label: "Text", icon: FileTextIcon, matches: (mimeType: string): boolean => mimeType.includes("text") },
];

const FALLBACK_FILE_KIND: FileKind = { label: "File", icon: FileTextIcon, matches: (): boolean => true };

function fileKindOf(file: File | FileMetadata): FileKind {
	return FILE_KINDS.find((kind: FileKind): boolean => kind.matches(file.type)) ?? FALLBACK_FILE_KIND;
}

/** A short, human label for a file's family ("PDF", "Archive", "File"). */
export function fileKindLabel(file: File | FileMetadata): string {
	return fileKindOf(file).label;
}

export interface FileKindIconProps {
	readonly file: File | FileMetadata;
	readonly className?: string;
}

/** The lucide icon for a file's family. */
export function FileKindIcon({ file, className }: FileKindIconProps): React.JSX.Element {
	const { icon: Icon } = fileKindOf(file);
	return <Icon className={cn("size-4", className)} aria-hidden />;
}

// ── Previews ────────────────────────────────────────────────────────────────

export interface FilePreviewImageProps {
	readonly src: string;
	readonly alt: string;
	/** Intrinsic size, in pixels (the CSS class decides the rendered size). */
	readonly width: number;
	readonly height: number;
	readonly className?: string;
	readonly onLoad?: () => void;
}

/**
 * A file thumbnail. `unoptimized`, because a picked file's preview is a
 * `blob:` object URL that only exists in this browser tab — the Next image
 * optimizer cannot fetch it.
 */
export function FilePreviewImage({ src, alt, width, height, className, onLoad }: FilePreviewImageProps): React.JSX.Element {
	return <Image unoptimized src={src} alt={alt} width={width} height={height} className={className} onLoad={onLoad} />;
}

// ── Drop zone ───────────────────────────────────────────────────────────────

/** The hook's drag handlers a drop zone wires up. */
export type FileDropHandlers = Pick<FileUploadActions, "handleDragEnter" | "handleDragLeave" | "handleDragOver" | "handleDrop">;

export interface FileDropZoneProps {
	readonly actions: FileDropHandlers;
	readonly className?: string;
	readonly children: React.ReactNode;
}

/**
 * The area files can be dropped on. Dropping is a pointer-only shortcut: the
 * keyboard and screen-reader path is the picker button rendered inside the
 * zone, so the zone itself is `role="presentation"` (as react-dropzone's root
 * is) instead of posing as a second control.
 */
export function FileDropZone({ actions, className, children }: FileDropZoneProps): React.JSX.Element {
	return (
		<div
			role="presentation"
			className={className}
			onDragEnter={actions.handleDragEnter}
			onDragLeave={actions.handleDragLeave}
			onDragOver={actions.handleDragOver}
			onDrop={actions.handleDrop}>
			{children}
		</div>
	);
}

// ── Errors ──────────────────────────────────────────────────────────────────

export interface FileUploadErrorsProps {
	readonly errors: readonly string[];
	readonly title?: string;
	readonly className?: string;
}

/** The hook's validation errors as a destructive alert; renders nothing without errors. */
export function FileUploadErrors({ errors, title = "File upload error(s)", className }: FileUploadErrorsProps): React.JSX.Element | null {
	if (errors.length === 0) {
		return null;
	}
	/* Each message names its file, so a message is its own stable key. */
	const uniqueErrors = Array.from(new Set(errors));
	return (
		<Alert variant="destructive" className={cn("mt-5", className)}>
			<CircleAlertIcon />
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>
				{uniqueErrors.map((error: string): React.JSX.Element => (
					<p key={error} className="last:mb-0">
						{error}
					</p>
				))}
			</AlertDescription>
		</Alert>
	);
}

// ── Per-file buttons ────────────────────────────────────────────────────────

type ButtonVariantProps = React.ComponentProps<typeof Button>;

export interface FileActionButtonProps {
	readonly fileId: string;
	/** Receives `fileId` when the button is pressed. */
	readonly onAction: (fileId: string) => void;
	readonly label: string;
	readonly variant?: ButtonVariantProps["variant"];
	readonly size?: ButtonVariantProps["size"];
	readonly className?: string;
	readonly children: React.ReactNode;
}

/** An icon button bound to one file of a list (remove, retry, preview…). */
export function FileActionButton({ fileId, onAction, label, variant = "ghost", size = "icon", className, children }: FileActionButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onAction(fileId);
	}, [fileId, onAction]);

	return (
		<Button type="button" onClick={handleClick} variant={variant} size={size} className={className} aria-label={label}>
			{children}
		</Button>
	);
}

// ── Progress ring ───────────────────────────────────────────────────────────

/** Percent at which a transfer is complete. */
export const COMPLETE_PERCENT = 100;
/** SVG user units of the ring's square viewBox. */
const RING_VIEWBOX_SIZE = 48;
const RING_CENTER = RING_VIEWBOX_SIZE / 2;
const RING_STROKE_WIDTH = 3;
const RING_RADIUS = RING_CENTER - RING_STROKE_WIDTH;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_VIEWBOX = `0 0 ${String(RING_VIEWBOX_SIZE)} ${String(RING_VIEWBOX_SIZE)}`;

export interface ProgressRingProps {
	/** 0–100. */
	readonly progress: number;
	readonly label: string;
	readonly className?: string;
	/** Classes of the filled arc (its colour). */
	readonly indicatorClassName?: string;
	/** Classes of the unfilled track (its colour). */
	readonly trackClassName?: string;
	readonly children?: React.ReactNode;
}

/** A circular progress indicator, with optional content (an icon, the percentage) in its centre. */
export function ProgressRing({ progress, label, className, indicatorClassName, trackClassName, children }: ProgressRingProps): React.JSX.Element {
	const remaining = RING_CIRCUMFERENCE * (1 - progress / COMPLETE_PERCENT);
	return (
		<div
			className={cn("relative size-12", className)}
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={COMPLETE_PERCENT}
			aria-valuenow={Math.round(progress)}>
			<svg className="size-full -rotate-90" viewBox={RING_VIEWBOX} aria-hidden>
				<circle
					cx={RING_CENTER}
					cy={RING_CENTER}
					r={RING_RADIUS}
					fill="none"
					stroke="currentColor"
					strokeWidth={RING_STROKE_WIDTH}
					className={cn("text-muted-foreground/20", trackClassName)}
				/>
				<circle
					cx={RING_CENTER}
					cy={RING_CENTER}
					r={RING_RADIUS}
					fill="none"
					stroke="currentColor"
					strokeWidth={RING_STROKE_WIDTH}
					strokeDasharray={RING_CIRCUMFERENCE}
					strokeDashoffset={remaining}
					strokeLinecap="round"
					className={cn("text-primary transition-all duration-300", indicatorClassName)}
				/>
			</svg>
			{children === undefined ? null : <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
		</div>
	);
}

// ── Simulated transfers ─────────────────────────────────────────────────────

export type TransferStatus = "uploading" | "completed" | "error";

export interface TransferState {
	readonly progress: number;
	readonly status: TransferStatus;
}

/** Files the demo did not start (the stored samples) count as transferred. */
export const COMPLETED_TRANSFER: TransferState = { progress: COMPLETE_PERCENT, status: "completed" };
/** A sample file shown in the failed state, so the retry affordance is visible. */
export const FAILED_TRANSFER: TransferState = { progress: 0, status: "error" };
const STARTED_TRANSFER: TransferState = { progress: 0, status: "uploading" };

/** How often the simulated progress advances, in milliseconds. */
const TRANSFER_TICK_MS = 300;
/** Percent added on every tick (deterministic, so the demo behaves the same every time). */
const TRANSFER_STEP_PERCENT = 10;

export interface SimulatedTransfers {
	/** The state of one file's transfer; files never started read as completed. */
	readonly transferOf: (fileId: string) => TransferState;
	/** Starts (or restarts) the simulated transfer of these files. */
	readonly start: (fileIds: readonly string[]) => void;
	/** Restarts one failed transfer. */
	readonly retry: (fileId: string) => void;
	/** Forgets a removed file. */
	readonly forget: (fileId: string) => void;
}

function advance(transfer: TransferState): TransferState {
	if (transfer.status !== "uploading") {
		return transfer;
	}
	const progress = Math.min(transfer.progress + TRANSFER_STEP_PERCENT, COMPLETE_PERCENT);
	return progress >= COMPLETE_PERCENT ? COMPLETED_TRANSFER : { progress, status: "uploading" };
}

function hasActiveTransfer(transfers: ReadonlyMap<string, TransferState>): boolean {
	return Array.from(transfers.values()).some((transfer: TransferState): boolean => transfer.status === "uploading");
}

const NO_TRANSFERS: ReadonlyMap<string, TransferState> = new Map<string, TransferState>();

/**
 * Demo-only progress for the examples' progress bars and rings. No file is
 * read or sent: a timer advances a percentage per file id.
 */
export function useSimulatedTransfers(initialTransfers: ReadonlyMap<string, TransferState> = NO_TRANSFERS): SimulatedTransfers {
	const [transfers, setTransfers] = React.useState<ReadonlyMap<string, TransferState>>(initialTransfers);
	const isActive = hasActiveTransfer(transfers);

	React.useEffect((): (() => void) | undefined => {
		if (!isActive) {
			return undefined;
		}
		const interval = window.setInterval((): void => {
			setTransfers((previous: ReadonlyMap<string, TransferState>): ReadonlyMap<string, TransferState> => {
				const next = new Map<string, TransferState>();
				for (const [fileId, transfer] of previous) {
					next.set(fileId, advance(transfer));
				}
				return next;
			});
		}, TRANSFER_TICK_MS);
		return (): void => {
			window.clearInterval(interval);
		};
	}, [isActive]);

	const transferOf = React.useCallback((fileId: string): TransferState => transfers.get(fileId) ?? COMPLETED_TRANSFER, [transfers]);

	const start = React.useCallback((fileIds: readonly string[]): void => {
		setTransfers((previous: ReadonlyMap<string, TransferState>): ReadonlyMap<string, TransferState> => {
			const next = new Map(previous);
			for (const fileId of fileIds) {
				next.set(fileId, STARTED_TRANSFER);
			}
			return next;
		});
	}, []);

	const retry = React.useCallback(
		(fileId: string): void => {
			start([fileId]);
		},
		[start],
	);

	const forget = React.useCallback((fileId: string): void => {
		setTransfers((previous: ReadonlyMap<string, TransferState>): ReadonlyMap<string, TransferState> => {
			const next = new Map(previous);
			next.delete(fileId);
			return next;
		});
	}, []);

	return React.useMemo((): SimulatedTransfers => ({ transferOf, start, retry, forget }), [forget, retry, start, transferOf]);
}

/** The ids of a batch of picked files, for `useSimulatedTransfers().start`. */
export function fileIdsOf(files: readonly FileWithPreview[]): readonly string[] {
	return files.map((file: FileWithPreview): string => file.id);
}

/** Initial transfers for examples that list the sample documents: one earlier attempt failed. */
export const SAMPLE_TRANSFERS: ReadonlyMap<string, TransferState> = new Map<string, TransferState>([[FAILED_SAMPLE_FILE_ID, FAILED_TRANSFER]]);
