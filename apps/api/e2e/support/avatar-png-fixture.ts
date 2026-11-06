/**
 * A 256 × 256 single-colour PNG (177 bytes, palette-compressed): the smallest
 * real image that meets the `USER_AVATAR` / `STORE_LOGO` pixel rules (square, at
 * least 256 × 256), so an upload of it passes `complete`'s pixel check.
 * Regenerate with sharp: `sharp({ create: { width: 256, height: 256, channels: 3,
 * background: { r: 0, g: 122, b: 77 } } }).png({ compressionLevel: 9, palette: true })`.
 */
export const AVATAR_PNG_BYTES: Buffer = Buffer.from(
	"89504e470d0a1a0a0000000d49484452000001000000010008030000006bac585400000003504c5445007a4d7ac7918b0000000970485973000003e8" +
		"000003e801b57b526b000000544944415478daedc101010000008090feafee080a000000000000000000000000000000000000000000000000000000" +
		"00000000000000000000000000000000000000000000000000000000000000000000000018010f00011c7209c30000000049454e44ae426082",
	"hex",
);
