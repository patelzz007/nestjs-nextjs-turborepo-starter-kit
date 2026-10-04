// ============================================
// test/support/eicar-signature-test-scanner.ts - TEST-ONLY malware scanner
// ============================================
// Not part of the application: specs inject it in place of MALWARE_SCANNER to
// drive the CLEAN / INFECTED paths. It flags the industry-standard EICAR test
// string and nothing else — it is not a malware scanner.

import { MalwareScannerUnavailableError, type MalwareScanner, type MalwareScanResult, type MalwareScanSubject } from "../../src/modules/storage/domain/malware-scanner.port";
import { streamChunkToBuffer, StreamChunkSchema } from "../../src/modules/storage/utils/object-stream.util";

/** The EICAR antivirus test string (harmless; every real scanner flags it). */
export const EICAR_TEST_SIGNATURE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
const EICAR_BYTES: Buffer = Buffer.from(EICAR_TEST_SIGNATURE, "latin1");
const ENGINE = "eicar-test";

export class EicarSignatureTestScanner implements MalwareScanner {
	public readonly engine: string = ENGINE;

	public async scan(subject: MalwareScanSubject): Promise<MalwareScanResult> {
		const content = await subject.openStream();
		if (content === null) {
			throw new MalwareScannerUnavailableError(ENGINE, `object for file ${subject.fileId} is missing`);
		}
		// Keep the last (signature length − 1) bytes so a match split across chunks is still found.
		let carry: Buffer = Buffer.alloc(0);
		for await (const chunk of content) {
			const window = Buffer.concat([carry, streamChunkToBuffer(StreamChunkSchema.parse(chunk))]);
			if (window.includes(EICAR_BYTES)) {
				content.destroy();
				return { outcome: "INFECTED", engine: ENGINE, signature: "EICAR-Test-File" };
			}
			carry = window.subarray(Math.max(0, window.length - (EICAR_BYTES.length - 1)));
		}
		return { outcome: "CLEAN", engine: ENGINE, detail: "no EICAR test signature (test scanner)" };
	}
}
