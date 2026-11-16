// What the FileType examples share: file sizes written for people.

const BYTES_PER_KB = 1_000;
const BYTES_PER_MB = 1_000_000;
/** One decimal for megabytes. */
const MB_DECIMALS = 1;

/** 2,140,000 bytes read "2.1 MB"; 860,000 read "860 KB". */
export function formatFileSize(bytes: number): string {
	return bytes < BYTES_PER_MB ? `${String(Math.round(bytes / BYTES_PER_KB))} KB` : `${(bytes / BYTES_PER_MB).toFixed(MB_DECIMALS)} MB`;
}
