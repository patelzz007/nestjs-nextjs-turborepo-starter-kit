// Ported from ReUI (`use-file-upload`): the state behind a file drop zone or
// picker — the picked files with preview URLs, drag-over state and
// validation errors. It is a CLIENT-SIDE PICKER ONLY: nothing is uploaded and
// no file leaves the browser. Uploading goes through the storage flow in
// rules/20-object-storage.md (presigned multipart upload), and the server
// re-validates size and type — `accept` / `maxSize` here are user experience,
// never a trust boundary.
//
// The exported names, options and the `[state, actions]` tuple match ReUI,
// with these deliberate deviations:
// - Error messages come from the `fileUpload` family of `UiKitLabelsProvider`
//   (override per usage with `labels`), never hardcoded English. An oversize
//   file is always reported by name (ReUI's generic "Some files exceed…" /
//   "File exceeds…" variants are folded into `fileTooLarge`).
// - Fixed from ReUI: a duplicate no longer aborts the rest of the batch;
//   `maxFiles` and duplicates are checked against the current files (not a
//   stale render's); change callbacks run outside state updaters (so they
//   fire once under StrictMode); every preview URL the hook created is
//   revoked on remove / clear / replace / unmount, not only images'; ids are
//   deterministic (`useId` + counter) instead of `Math.random`.
// - `formatBytes` is the kit formatter (`lib/format/bytes`), re-exported
//   here for ReUI call sites; it takes an options object, not `decimals`.
"use client";

import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

export { formatBytes, type FormatBytesOptions } from "@workspace/ui/lib/format/bytes";

/** Copy for the hook's validation errors — the `fileUpload` family of `UiKitLabels`. */
export interface FileUploadLabels {
	/** A file larger than `maxSize`; `maxSize` arrives formatted by `formatSize`. */
	readonly fileTooLarge: (fileName: string, maxSize: string) => string;
	/** A file whose type / extension is not in `accept`. */
	readonly fileTypeNotAccepted: (fileName: string) => string;
	/** A batch that would take the list past `maxFiles`. */
	readonly tooManyFiles: (maxFiles: number) => string;
	/** Formats a byte count for the messages above (e.g. "2 MB"). */
	readonly formatSize: (bytes: number) => string;
}

/** An already-stored file (e.g. the current avatar), shown alongside picked ones. */
export interface FileMetadata {
	readonly name: string;
	readonly size: number;
	readonly type: string;
	readonly url: string;
	readonly id: string;
}

export interface FileWithPreview {
	readonly file: File | FileMetadata;
	readonly id: string;
	/** An object URL for a picked `File`, or the stored file's `url`. */
	readonly preview?: string | undefined;
}

export interface FileUploadOptions {
	/** Upper bound on the list (multiple mode only). Default: unbounded. */
	readonly maxFiles?: number | undefined;
	/** Largest accepted file, in bytes. Default: unbounded. */
	readonly maxSize?: number | undefined;
	/** The `<input accept>` syntax: MIME types (`image/png`), wildcards (`image/*`), extensions (`.pdf`), comma-separated. Default `"*"`. */
	readonly accept?: string | undefined;
	/** Keep a list (true) or replace the single file on each pick (false, the default). */
	readonly multiple?: boolean | undefined;
	readonly initialFiles?: readonly FileMetadata[] | undefined;
	/** Every change to the list. */
	readonly onFilesChange?: ((files: readonly FileWithPreview[]) => void) | undefined;
	/** Only the files a pick or drop added. */
	readonly onFilesAdded?: ((addedFiles: readonly FileWithPreview[]) => void) | undefined;
	readonly onError?: ((errors: readonly string[]) => void) | undefined;
	/** Per-usage copy overrides. Keep it a module constant. */
	readonly labels?: UiKitLabelsOverride<"fileUpload"> | undefined;
}

export interface FileUploadState {
	readonly files: readonly FileWithPreview[];
	readonly isDragging: boolean;
	readonly errors: readonly string[];
}

export type FileUploadInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
	readonly ref: React.Ref<HTMLInputElement>;
};

export interface FileUploadActions {
	readonly addFiles: (files: FileList | readonly File[]) => void;
	readonly removeFile: (id: string) => void;
	readonly clearFiles: () => void;
	readonly clearErrors: () => void;
	readonly handleDragEnter: (event: React.DragEvent<HTMLElement>) => void;
	readonly handleDragLeave: (event: React.DragEvent<HTMLElement>) => void;
	readonly handleDragOver: (event: React.DragEvent<HTMLElement>) => void;
	readonly handleDrop: (event: React.DragEvent<HTMLElement>) => void;
	readonly handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	readonly openFileDialog: () => void;
	/** Props for the hidden `<input type="file">` (spread them, then add your own `className`). */
	readonly getInputProps: (props?: React.InputHTMLAttributes<HTMLInputElement>) => FileUploadInputProps;
}

/** `accept` meaning "anything". */
const ACCEPT_ANY = "*";
const ACCEPT_SEPARATOR = ",";
const EXTENSION_PREFIX = ".";
const MIME_WILDCARD_SUFFIX = "/*";
const MIME_SEPARATOR = "/";

/** `"Report.final.PDF"` → `".pdf"`; no dot → `""`. */
function fileExtension(name: string): string {
	const dot = name.lastIndexOf(EXTENSION_PREFIX);
	return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

/** Whether a file matches the `<input accept>` list (MIME type, `type/*` wildcard or extension). */
export function isFileAccepted(file: Pick<FileMetadata, "name" | "type">, accept: string): boolean {
	if (accept.trim() === ACCEPT_ANY) {
		return true;
	}
	const extension = fileExtension(file.name);
	const mimeType = file.type.toLowerCase();
	return accept
		.split(ACCEPT_SEPARATOR)
		.map((entry: string): string => entry.trim().toLowerCase())
		.filter((entry: string): boolean => entry !== "")
		.some((entry: string): boolean => {
			if (entry === ACCEPT_ANY) {
				return true;
			}
			if (entry.startsWith(EXTENSION_PREFIX)) {
				return extension === entry;
			}
			if (entry.endsWith(MIME_WILDCARD_SUFFIX)) {
				const [baseType] = entry.split(MIME_SEPARATOR);
				return mimeType.startsWith(`${baseType ?? ""}${MIME_SEPARATOR}`);
			}
			return mimeType === entry;
		});
}

function isSameFile(existing: FileWithPreview, candidate: File): boolean {
	return existing.file.name === candidate.name && existing.file.size === candidate.size;
}

/** Revokes the object URL the hook created for a picked file (stored files' URLs are not ours). */
function revokePreview(entry: FileWithPreview): void {
	if (entry.preview !== undefined && entry.file instanceof File) {
		URL.revokeObjectURL(entry.preview);
	}
}

function fromMetadata(file: FileMetadata): FileWithPreview {
	return { file, id: file.id, preview: file.url };
}

/** Picker / drop-zone state: `[state, actions]`. See the file header — this never uploads. */
export function useFileUpload(options: FileUploadOptions = {}): [FileUploadState, FileUploadActions] {
	const {
		maxFiles = Number.POSITIVE_INFINITY,
		maxSize = Number.POSITIVE_INFINITY,
		accept = ACCEPT_ANY,
		multiple = false,
		initialFiles,
		onFilesChange,
		onFilesAdded,
		onError,
		labels: labelsOverride,
	} = options;
	const labels = useUiKitLabels("fileUpload", labelsOverride);
	const idPrefix = React.useId();
	const idCounter = React.useRef(0);
	const inputRef = React.useRef<HTMLInputElement>(null);

	const [initialList] = React.useState((): readonly FileWithPreview[] => (initialFiles ?? []).map(fromMetadata));
	/* The source of truth between renders: two picks in one tick must see each other's files. */
	const filesRef = React.useRef<readonly FileWithPreview[]>(initialList);
	const [files, setFiles] = React.useState<readonly FileWithPreview[]>(initialList);
	const [errors, setErrors] = React.useState<readonly string[]>([]);
	const [isDragging, setIsDragging] = React.useState(false);

	const commitFiles = React.useCallback(
		(next: readonly FileWithPreview[]): void => {
			filesRef.current = next;
			setFiles(next);
			onFilesChange?.(next);
		},
		[onFilesChange],
	);

	const resetInput = React.useCallback((): void => {
		if (inputRef.current !== null) {
			inputRef.current.value = "";
		}
	}, []);

	const reportErrors = React.useCallback(
		(next: readonly string[]): void => {
			setErrors(next);
			if (next.length > 0) {
				onError?.(next);
			}
		},
		[onError],
	);

	const validateFile = React.useCallback(
		(file: File): string | null => {
			if (file.size > maxSize) {
				return labels.fileTooLarge(file.name, labels.formatSize(maxSize));
			}
			if (!isFileAccepted(file, accept)) {
				return labels.fileTypeNotAccepted(file.name);
			}
			return null;
		},
		[accept, labels, maxSize],
	);

	const addFiles = React.useCallback(
		(incoming: FileList | readonly File[]): void => {
			const candidates = Array.from(incoming);
			if (candidates.length === 0) {
				return;
			}
			const current = filesRef.current;
			if (multiple && current.length + candidates.length > maxFiles) {
				reportErrors([labels.tooManyFiles(maxFiles)]);
				resetInput();
				return;
			}

			const nextErrors: string[] = [];
			const added: FileWithPreview[] = [];
			for (const file of candidates) {
				const isDuplicate = multiple && [...current, ...added].some((existing: FileWithPreview): boolean => isSameFile(existing, file));
				if (isDuplicate) {
					continue;
				}
				const error = validateFile(file);
				if (error !== null) {
					nextErrors.push(error);
					continue;
				}
				idCounter.current += 1;
				added.push({ file, id: `${idPrefix}-${String(idCounter.current)}`, preview: URL.createObjectURL(file) });
			}

			reportErrors(nextErrors);
			if (added.length > 0) {
				if (!multiple) {
					current.forEach(revokePreview);
				}
				onFilesAdded?.(added);
				commitFiles(multiple ? [...current, ...added] : added);
			}
			resetInput();
		},
		[commitFiles, idPrefix, labels, maxFiles, multiple, onFilesAdded, reportErrors, resetInput, validateFile],
	);

	const removeFile = React.useCallback(
		(id: string): void => {
			const current = filesRef.current;
			const removed = current.find((entry: FileWithPreview): boolean => entry.id === id);
			if (removed === undefined) {
				return;
			}
			revokePreview(removed);
			setErrors([]);
			commitFiles(current.filter((entry: FileWithPreview): boolean => entry.id !== id));
		},
		[commitFiles],
	);

	const clearFiles = React.useCallback((): void => {
		filesRef.current.forEach(revokePreview);
		resetInput();
		setErrors([]);
		commitFiles([]);
	}, [commitFiles, resetInput]);

	const clearErrors = React.useCallback((): void => {
		setErrors([]);
	}, []);

	/* Unmount: release every object URL still held. */
	React.useEffect((): (() => void) => {
		return (): void => {
			filesRef.current.forEach(revokePreview);
		};
	}, []);

	const handleDragEnter = React.useCallback((event: React.DragEvent<HTMLElement>): void => {
		event.preventDefault();
		event.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLElement>): void => {
		event.preventDefault();
		event.stopPropagation();
		/* Moving onto a child of the zone is not leaving it. */
		if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
			return;
		}
		setIsDragging(false);
	}, []);

	const handleDragOver = React.useCallback((event: React.DragEvent<HTMLElement>): void => {
		event.preventDefault();
		event.stopPropagation();
	}, []);

	const handleDrop = React.useCallback(
		(event: React.DragEvent<HTMLElement>): void => {
			event.preventDefault();
			event.stopPropagation();
			setIsDragging(false);
			if (inputRef.current?.disabled === true) {
				return;
			}
			const dropped = Array.from(event.dataTransfer.files);
			if (multiple) {
				addFiles(dropped);
				return;
			}
			const [first] = dropped;
			if (first !== undefined) {
				addFiles([first]);
			}
		},
		[addFiles, multiple],
	);

	const handleFileChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			if (event.target.files !== null) {
				addFiles(event.target.files);
			}
		},
		[addFiles],
	);

	const openFileDialog = React.useCallback((): void => {
		inputRef.current?.click();
	}, []);

	const getInputProps = React.useCallback(
		(props: React.InputHTMLAttributes<HTMLInputElement> = {}): FileUploadInputProps => ({
			...props,
			type: "file",
			onChange: handleFileChange,
			accept: props.accept ?? accept,
			multiple: props.multiple ?? multiple,
			ref: inputRef,
		}),
		[accept, handleFileChange, multiple],
	);

	const state = React.useMemo((): FileUploadState => ({ files, isDragging, errors }), [errors, files, isDragging]);
	const actions = React.useMemo(
		(): FileUploadActions => ({
			addFiles,
			removeFile,
			clearFiles,
			clearErrors,
			handleDragEnter,
			handleDragLeave,
			handleDragOver,
			handleDrop,
			handleFileChange,
			openFileDialog,
			getInputProps,
		}),
		[addFiles, clearErrors, clearFiles, getInputProps, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, handleFileChange, openFileDialog, removeFile],
	);

	return [state, actions];
}
