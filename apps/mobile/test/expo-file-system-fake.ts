// expo-file-system under Jest (jest.setup.ts mocks "expo-file-system" with
// this module): files, downloads and uploads are native. Here a file is bytes
// a test puts at a uri (`putFile`); a download stores the bytes a test serves
// at its address (`serveDownload`) — or fails, for an address nothing serves;
// and an upload is recorded (`uploads`) and answered with the status the test
// sets (`answerUploadsWith`, 204 by default). Reset before every test.

import { isStringPrimitive } from "@workspace/shared";
import type { DownloadOptions, UploadOptions, UploadResult } from "expo-file-system";

/** How a file is sent, as expo-file-system numbers it. */
export const UploadType = { BINARY_CONTENT: 0, MULTIPART: 1 };

/** One upload a test can inspect. */
export interface RecordedUpload {
	readonly uri: string;
	readonly url: string;
	readonly options: UploadOptions | undefined;
}

const NO_CONTENT = 204;
const CACHE_URI = "file:///cache";

const stored = new Map<string, Uint8Array>();
const served = new Map<string, Uint8Array>();
const createdFolders = new Set<string>();
const recorded: RecordedUpload[] = [];
let uploadStatus = NO_CONTENT;

/** A path built from parts, as the real constructors join them. */
type PathPart = string | File | Directory;

function joinPath(parts: readonly PathPart[]): string {
	return parts.map((part: PathPart): string => (isStringPrimitive(part) ? part : part.uri)).join("/");
}

export class Directory {
	public readonly uri: string;

	public constructor(...parts: PathPart[]) {
		this.uri = joinPath(parts);
	}

	public create(): void {
		createdFolders.add(this.uri);
	}
}

export const Paths = {
	get cache(): Directory {
		return new Directory(CACHE_URI);
	},
};

/** A read handle over a stored file. */
class FakeFileHandle {
	private readonly _bytes: Uint8Array;
	private _closed = false;

	public constructor(bytes: Uint8Array) {
		this._bytes = bytes;
	}

	public readBytesSync(length: number): Uint8Array {
		if (this._closed) {
			throw new Error("The file handle is closed.");
		}
		return this._bytes.slice(0, length);
	}

	public close(): void {
		this._closed = true;
	}
}

export class File {
	public readonly uri: string;

	public constructor(...parts: PathPart[]) {
		this.uri = joinPath(parts);
	}

	public get size(): number {
		return this.stored().length;
	}

	public bytes(): Promise<Uint8Array> {
		const bytes = stored.get(this.uri);
		return bytes === undefined ? Promise.reject(new Error(`No file at ${this.uri}`)) : Promise.resolve(bytes);
	}

	public create(): void {
		stored.set(this.uri, new Uint8Array());
	}

	public writeSync(content: string | Uint8Array): void {
		stored.set(this.uri, isStringPrimitive(content) ? new TextEncoder().encode(content) : content);
	}

	public open(): FakeFileHandle {
		return new FakeFileHandle(this.stored());
	}

	public upload(url: string, options?: UploadOptions): Promise<UploadResult> {
		recorded.push({ uri: this.uri, url, options });
		return Promise.resolve({ status: uploadStatus, body: "", headers: {} });
	}

	public static downloadFileAsync(url: string, destination: File | Directory, _options?: DownloadOptions): Promise<File> {
		const bytes = served.get(url);
		if (bytes === undefined) {
			return Promise.reject(new Error(`Nothing is served at ${url}`));
		}
		const file = destination instanceof File ? destination : new File(destination, "download");
		stored.set(file.uri, bytes);
		return Promise.resolve(file);
	}

	private stored(): Uint8Array {
		const bytes = stored.get(this.uri);
		if (bytes === undefined) {
			throw new Error(`No file at ${this.uri}`);
		}
		return bytes;
	}
}

/** A file the app can read at `uri`. */
export function putFile(uri: string, bytes: Uint8Array): void {
	stored.set(uri, bytes);
}

/** The bytes a download from `url` receives. */
export function serveDownload(url: string, bytes: Uint8Array): void {
	served.set(url, bytes);
}

/** Whether the app has created the folder at `uri`. */
export function hasFolder(uri: string): boolean {
	return createdFolders.has(uri);
}

/** Every upload since the last reset, oldest first. */
export function uploads(): readonly RecordedUpload[] {
	return [...recorded];
}

/** The HTTP status storage answers uploads with. */
export function answerUploadsWith(status: number): void {
	uploadStatus = status;
}

export function reset(): void {
	stored.clear();
	served.clear();
	createdFolders.clear();
	recorded.length = 0;
	uploadStatus = NO_CONTENT;
}
