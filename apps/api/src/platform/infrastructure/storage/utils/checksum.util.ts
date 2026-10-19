/** Convert a lowercase hex SHA-256 digest to the base64 form S3 expects in checksum headers. */
export function sha256HexToBase64(hexDigest: string): string {
	return Buffer.from(hexDigest, "hex").toString("base64");
}

/** Convert an S3 `ChecksumSHA256` header value (base64) to lowercase hex for API contracts. */
export function sha256Base64ToHex(base64Digest: string): string {
	return Buffer.from(base64Digest, "base64").toString("hex");
}
