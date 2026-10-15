// expo-file-system under Jest (jest.setup.ts mocks "expo-file-system" with
// this module): files and uploads are native. Here a file is bytes a test puts
// at a uri (`putFile`), and an upload is recorded (`uploads`) and answered with
// the status the test sets (`answerUploadsWith`, 204 by default). Reset before
// every test.

import type { UploadOptions, UploadResult } from "expo-file-system";

/** How a file is sent, as expo-file-system numbers it. */
export const UploadType = { BINARY_CONTENT: 0, MULTIPART: 1 };

/** One upload a test can inspect. */
export interface RecordedUpload {
	readonly uri: string;
	readonly url: string;
	readonly options: UploadOptions | undefined;
}

const NO_CONTENT = 204;

const stored = new Map<string, Uint8Array>();
const recorded: RecordedUpload[] = [];
let uploadStatus = NO_CONTENT;

export class File {
	public readonly uri: string;

	public constructor(uri: string) {
		this.uri = uri;
	}

	public bytes(): Promise<Uint8Array> {
		const bytes = stored.get(this.uri);
		return bytes === undefined ? Promise.reject(new Error(`No file at ${this.uri}`)) : Promise.resolve(bytes);
	}

	public upload(url: string, options?: UploadOptions): Promise<UploadResult> {
		recorded.push({ uri: this.uri, url, options });
		return Promise.resolve({ status: uploadStatus, body: "", headers: {} });
	}
}

/** A file the app can read at `uri`. */
export function putFile(uri: string, bytes: Uint8Array): void {
	stored.set(uri, bytes);
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
	recorded.length = 0;
	uploadStatus = NO_CONTENT;
}
