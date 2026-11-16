// Picking files to upload (the web kit's `useFileUpload`): the system's
// document picker (expo-document-picker), or its photo library for
// `source: "images"` (expo-image-picker), with each pick checked against
// what the caller accepts — the types, the size, how many — and kept in a
// list. Uploading is the caller's job: it reports each file's progress and
// outcome back through `setProgress` / `setStatus`, and the list (and any
// view built on it: a strip of chips, a grid of thumbnails, a table) shows it.
//
// What the pickers answer is third-party data, so it is validated with zod
// before anything reads it; a cancelled pick changes nothing. Messages are
// generic and overridable (`labels`).

import { getDocumentAsync } from "expo-document-picker";
import { launchImageLibraryAsync } from "expo-image-picker";
import * as React from "react";
import { z } from "zod";

/** Where a file is in its upload. */
export type UploadStatus = "ready" | "uploading" | "done" | "error";

/** A picked file, and what has happened to it since. */
export interface UploadFile {
	/** Unique in the list (the picker's address, made unique). */
	readonly id: string;
	readonly name: string;
	/** In bytes; `null` when the picker did not say. */
	readonly size: number | null;
	/** `application/pdf`, `image/png`; `null` when the picker did not say. */
	readonly mimeType: string | null;
	/** Where the file is on the device, to upload from or to preview an image. */
	readonly uri: string;
	readonly status: UploadStatus;
	/** 0–1 while uploading; `null` before. */
	readonly progress: number | null;
	/** Why it failed, when it did. */
	readonly error: string | null;
}

/** Why a pick was turned away. */
export type UploadRejection = { readonly kind: "type"; readonly name: string } | { readonly kind: "size"; readonly name: string } | { readonly kind: "count" };

/** The messages a rejection shows; generic and overridable. */
export interface FileUploadLabels {
	readonly wrongType: (name: string) => string;
	readonly tooLarge: (name: string, maxSize: string) => string;
	readonly tooMany: (maxFiles: number) => string;
}

const BYTES_PER_UNIT = 1024;
const SIZE_UNITS: readonly string[] = ["B", "KB", "MB", "GB"];

/** A byte count as people read it: "512 B", "2.4 MB". */
export function formatFileSize(bytes: number): string {
	let value = bytes;
	let unit = 0;
	while (value >= BYTES_PER_UNIT && unit < SIZE_UNITS.length - 1) {
		value /= BYTES_PER_UNIT;
		unit += 1;
	}
	return `${unit === 0 ? String(value) : value.toFixed(1)} ${SIZE_UNITS.at(unit) ?? "B"}`;
}

export const DEFAULT_FILE_UPLOAD_LABELS: FileUploadLabels = {
	wrongType: (name: string): string => `${name} is not a type of file this accepts.`,
	tooLarge: (name: string, maxSize: string): string => `${name} is larger than ${maxSize}.`,
	tooMany: (maxFiles: number): string => `You can add up to ${String(maxFiles)} ${maxFiles === 1 ? "file" : "files"}.`,
};

/** Whether a file matches one of `accept`'s entries: a MIME type (`image/png`), a family (`image/*`) or an extension (`.pdf`). */
export function acceptsFile(accept: readonly string[], name: string, mimeType: string | null): boolean {
	if (accept.length === 0) {
		return true;
	}
	const lowerName = name.toLowerCase();
	const type = (mimeType ?? "").toLowerCase();
	return accept.some((entry: string): boolean => {
		const wanted = entry.trim().toLowerCase();
		if (wanted.startsWith(".")) {
			return lowerName.endsWith(wanted);
		}
		if (wanted.endsWith("/*")) {
			return type.startsWith(wanted.slice(0, -1));
		}
		return type === wanted;
	});
}

/** What the document picker answers: validated, never trusted as typed. */
const DocumentPickerResultSchema = z.union([
	z.object({ canceled: z.literal(true) }),
	z.object({
		canceled: z.literal(false),
		assets: z.array(z.object({ uri: z.string().min(1), name: z.string(), size: z.number().nonnegative().optional(), mimeType: z.string().optional() })),
	}),
]);

/** What the photo library answers. */
const ImagePickerResultSchema = z.union([
	z.object({ canceled: z.literal(true) }),
	z.object({
		canceled: z.literal(false),
		assets: z.array(z.object({ uri: z.string().min(1), fileName: z.string().nullish(), fileSize: z.number().nonnegative().nullish(), mimeType: z.string().nullish() })),
	}),
]);

/** A picked file before it joins the list. */
export interface PickedFile {
	readonly uri: string;
	readonly name: string;
	readonly size: number | null;
	readonly mimeType: string | null;
}

/** Opens a picker and gives back what was picked (nothing when cancelled). */
export type PickFiles = (options: { readonly accept: readonly string[]; readonly multiple: boolean }) => Promise<readonly PickedFile[]>;

/** The system document picker. */
export const pickDocuments: PickFiles = async ({ accept, multiple }) => {
	const types = accept.filter((entry: string): boolean => entry.includes("/"));
	const result = DocumentPickerResultSchema.parse(await getDocumentAsync({ type: types.length === 0 ? "*/*" : types, multiple, copyToCacheDirectory: true }));
	return result.canceled ? [] : result.assets.map((asset): PickedFile => ({ uri: asset.uri, name: asset.name, size: asset.size ?? null, mimeType: asset.mimeType ?? null }));
};

/** The system photo library. */
export const pickImages: PickFiles = async ({ multiple }) => {
	const result = ImagePickerResultSchema.parse(await launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: multiple, quality: 1 }));
	return result.canceled
		? []
		: result.assets.map((asset): PickedFile => ({
				uri: asset.uri,
				name: asset.fileName ?? asset.uri.split("/").at(-1) ?? "image",
				size: asset.fileSize ?? null,
				mimeType: asset.mimeType ?? null,
			}));
};

export interface FileUploadOptions {
	/** What may be picked: MIME types (`image/png`), families (`image/*`) or extensions (`.pdf`). Empty: anything. */
	readonly accept?: readonly string[] | undefined;
	/** The largest file, in bytes. */
	readonly maxSize?: number | undefined;
	/** The most files the list holds. */
	readonly maxFiles?: number | undefined;
	/** Lets one pick hold several files (default: `maxFiles` above 1). */
	readonly multiple?: boolean | undefined;
	/** `documents` (default): the document picker. `images`: the photo library. */
	readonly source?: "documents" | "images" | undefined;
	/** Files already uploaded (an avatar, an existing gallery). */
	readonly initialFiles?: readonly UploadFile[] | undefined;
	readonly labels?: Partial<FileUploadLabels> | undefined;
	/** The picker to open (tests pass their own). */
	readonly pick?: PickFiles | undefined;
}

export interface FileUpload {
	readonly files: readonly UploadFile[];
	/** Why the last pick's turned-away files were refused. */
	readonly errors: readonly string[];
	/** Whether the list holds `maxFiles`. */
	readonly isFull: boolean;
	/** Opens the picker; what passes the checks joins the list. */
	readonly openPicker: () => Promise<void>;
	/** Adds files picked some other way (a camera), checked the same way. */
	readonly addFiles: (picked: readonly PickedFile[]) => void;
	readonly removeFile: (id: string) => void;
	readonly clearFiles: () => void;
	/** Moves a file to `toIndex` (a sortable grid). */
	readonly moveFile: (id: string, toIndex: number) => void;
	/** Reports an upload's progress (0–1): the file is uploading. */
	readonly setProgress: (id: string, progress: number) => void;
	/** Reports an upload's outcome. */
	readonly setStatus: (id: string, status: UploadStatus, error?: string) => void;
}

interface FileUploadState {
	readonly files: readonly UploadFile[];
	readonly errors: readonly string[];
}

/** Picks, checks and lists files to upload. */
export function useFileUpload({ accept = [], maxSize, maxFiles, multiple, source = "documents", initialFiles = [], labels, pick }: FileUploadOptions = {}): FileUpload {
	const [state, setState] = React.useState<FileUploadState>({ files: initialFiles, errors: [] });
	const names = React.useMemo((): FileUploadLabels => ({ ...DEFAULT_FILE_UPLOAD_LABELS, ...labels }), [labels]);
	const allowsMany = multiple ?? (maxFiles === undefined || maxFiles > 1);

	const addFiles = React.useCallback(
		(picked: readonly PickedFile[]): void => {
			setState((current: FileUploadState): FileUploadState => {
				const errors: string[] = [];
				const added: UploadFile[] = [];
				for (const file of picked) {
					if (!acceptsFile(accept, file.name, file.mimeType)) {
						errors.push(names.wrongType(file.name));
					} else if (maxSize !== undefined && file.size !== null && file.size > maxSize) {
						errors.push(names.tooLarge(file.name, formatFileSize(maxSize)));
					} else if (maxFiles !== undefined && current.files.length + added.length >= maxFiles) {
						errors.push(names.tooMany(maxFiles));
						break;
					} else {
						added.push({ id: `${file.uri}#${String(current.files.length + added.length)}`, ...file, status: "ready", progress: null, error: null });
					}
				}
				const files = allowsMany ? [...current.files, ...added] : added.length > 0 ? added.slice(0, 1) : current.files;
				return { files, errors };
			});
		},
		[accept, allowsMany, maxFiles, maxSize, names],
	);
	const openPicker = React.useCallback(async (): Promise<void> => {
		const picker = pick ?? (source === "images" ? pickImages : pickDocuments);
		addFiles(await picker({ accept, multiple: allowsMany }));
	}, [accept, addFiles, allowsMany, pick, source]);
	const update = React.useCallback((id: string, change: (file: UploadFile) => UploadFile): void => {
		setState((current: FileUploadState): FileUploadState => ({
			...current,
			files: current.files.map((file: UploadFile): UploadFile => (file.id === id ? change(file) : file)),
		}));
	}, []);
	const removeFile = React.useCallback((id: string): void => {
		setState((current: FileUploadState): FileUploadState => ({ files: current.files.filter((file: UploadFile): boolean => file.id !== id), errors: [] }));
	}, []);
	const clearFiles = React.useCallback((): void => {
		setState({ files: [], errors: [] });
	}, []);
	const moveFile = React.useCallback((id: string, toIndex: number): void => {
		setState((current: FileUploadState): FileUploadState => {
			const moving = current.files.find((file: UploadFile): boolean => file.id === id);
			if (moving === undefined) {
				return current;
			}
			const rest = current.files.filter((file: UploadFile): boolean => file.id !== id);
			const at = Math.min(Math.max(0, toIndex), rest.length);
			return { ...current, files: [...rest.slice(0, at), moving, ...rest.slice(at)] };
		});
	}, []);
	const setProgress = React.useCallback(
		(id: string, progress: number): void => {
			update(id, (file: UploadFile): UploadFile => ({ ...file, status: "uploading", progress: Math.min(1, Math.max(0, progress)), error: null }));
		},
		[update],
	);
	const setStatus = React.useCallback(
		(id: string, status: UploadStatus, error?: string): void => {
			update(id, (file: UploadFile): UploadFile => ({ ...file, status, progress: status === "done" ? 1 : file.progress, error: error ?? null }));
		},
		[update],
	);
	return {
		files: state.files,
		errors: state.errors,
		isFull: maxFiles !== undefined && state.files.length >= maxFiles,
		openPicker,
		addFiles,
		removeFile,
		clearFiles,
		moveFile,
		setProgress,
		setStatus,
	};
}
