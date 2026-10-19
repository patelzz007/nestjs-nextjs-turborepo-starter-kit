import type { Readable } from "node:stream";

/** A rendered report as a route answers it: its download name, media type and streamed bytes. */
export interface ReportFile {
	readonly fileName: string;
	readonly contentType: string;
	readonly body: Readable;
}
