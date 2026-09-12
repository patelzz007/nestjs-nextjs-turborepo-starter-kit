import net from "node:net";

import { sanitizePostgresText } from "./sanitize-postgres-text.util";

const INSTREAM_CHUNK_BYTES = 2048;
const CLAMAV_SCAN_TIMEOUT_MS = 120_000;
const CLAMAV_SCAN_RESULT_MAX_LENGTH = 500;

export interface ClamAvScanResult {
	readonly clean: boolean;
	readonly scanResult: string;
}

/** Scan a buffer with ClamAV over the INSTREAM TCP protocol (port 3310 by default). */
export function scanBufferWithClamAv(buffer: Buffer, host: string, port: number): Promise<ClamAvScanResult> {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({ host, port });
		const responseChunks: Buffer[] = [];

		socket.setTimeout(CLAMAV_SCAN_TIMEOUT_MS, () => {
			socket.destroy();
			reject(new Error(`ClamAV scan timed out after ${String(CLAMAV_SCAN_TIMEOUT_MS)}ms`));
		});

		socket.on("connect", () => {
			socket.write(Buffer.from("zINSTREAM\0"));
			let offset = 0;
			while (offset < buffer.length) {
				const chunk = buffer.subarray(offset, offset + INSTREAM_CHUNK_BYTES);
				const sizeBuffer = Buffer.alloc(4);
				sizeBuffer.writeUInt32BE(chunk.length, 0);
				socket.write(sizeBuffer);
				socket.write(chunk);
				offset += INSTREAM_CHUNK_BYTES;
			}
			const endBuffer = Buffer.alloc(4);
			endBuffer.writeUInt32BE(0, 0);
			socket.write(endBuffer);
		});

		socket.on("data", (chunk: Buffer) => {
			responseChunks.push(chunk);
		});

		socket.on("end", () => {
			const raw = Buffer.concat(responseChunks).toString("utf8");
			const response = sanitizePostgresText(raw, CLAMAV_SCAN_RESULT_MAX_LENGTH).trim();
			const lines = response
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.length > 0);
			const summary = lines.find((line) => line.includes("stream:")) ?? lines.at(-1) ?? response;
			const infected = /FOUND/i.test(summary);
			const clean = !infected && /OK/i.test(summary);
			if (!clean && !infected) {
				reject(new Error(`Unexpected ClamAV response: ${summary}`));
				return;
			}
			resolve({
				clean,
				scanResult: summary.length > 0 ? summary : clean ? "OK" : "FOUND",
			});
		});

		socket.on("error", (error) => {
			reject(error);
		});
	});
}
