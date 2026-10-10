// ============================================
// generator/ico.ts — PNG images → a .ico file
// ============================================
// The ICO container with PNG-encoded entries (supported by every current
// browser, Safari included): a 6-byte header, one 16-byte directory entry per
// image, then the PNG files back to back.

const RESERVED = 0;
const TYPE_ICON = 1;
const HEADER_SIZE = 6;
const ENTRY_SIZE = 16;
/** A width or height of 256 is written as 0. */
const LARGEST_SIDE = 256;
const NO_PALETTE = 0;
const COLOR_PLANES = 1;
const BITS_PER_PIXEL = 32;
const BYTE_MASK = 0xff;
const BITS_PER_BYTE = 8;
const BYTES_PER_UINT32 = 4;

export interface IcoImage {
	/** Side of the square image, in pixels. */
	readonly size: number;
	readonly png: Uint8Array;
}

function uint16LittleEndian(value: number): readonly number[] {
	return [value & BYTE_MASK, (value >>> BITS_PER_BYTE) & BYTE_MASK];
}

function uint32LittleEndian(value: number): readonly number[] {
	return Array.from({ length: BYTES_PER_UINT32 }, (_byte: undefined, index: number): number => (value >>> (BITS_PER_BYTE * index)) & BYTE_MASK);
}

export function encodeIco(images: readonly IcoImage[]): Uint8Array {
	let offset = HEADER_SIZE + ENTRY_SIZE * images.length;
	const entries = images.flatMap((image: IcoImage): readonly number[] => {
		const side = image.size >= LARGEST_SIDE ? 0 : image.size;
		const entry = [
			side,
			side,
			NO_PALETTE,
			RESERVED,
			...uint16LittleEndian(COLOR_PLANES),
			...uint16LittleEndian(BITS_PER_PIXEL),
			...uint32LittleEndian(image.png.length),
			...uint32LittleEndian(offset),
		];
		offset += image.png.length;
		return entry;
	});
	const header = [...uint16LittleEndian(RESERVED), ...uint16LittleEndian(TYPE_ICON), ...uint16LittleEndian(images.length)];
	return Uint8Array.from([...header, ...entries, ...images.flatMap((image: IcoImage): readonly number[] => [...image.png])]);
}
