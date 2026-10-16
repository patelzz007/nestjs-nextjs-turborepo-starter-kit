import { QR_CODEWORD_BITS, QrBitBuffer } from "./qr-bit-buffer";
import { type QrErrorCorrectionLevel } from "./qr-error-correction";
import { reedSolomonGenerator, reedSolomonRemainder } from "./qr-reed-solomon";
import { characterCountBits, QR_MODE_INDICATOR, QR_MODE_INDICATOR_BITS, type QrSegment } from "./qr-segment";
import { dataCodewords, ecBlockCount, ecCodewordsPerBlock, totalCodewords } from "./qr-version-table";

/** The terminator is up to four zero bits (ISO/IEC 18004 §7.4.9). */
const MAX_TERMINATOR_BITS = 4;

/** Pad codewords fill the remaining capacity, alternating 11101100 and 00010001 (§7.4.10). */
const PAD_CODEWORDS: readonly [first: number, second: number] = [0xec, 0x11];

/**
 * The data codewords of `segments` for `version` at `level`: each segment's mode indicator,
 * character count and data, then the terminator, zero bits to a byte boundary, and pad
 * codewords up to the capacity. The caller has already checked that the segments fit.
 */
export function buildDataCodewords(segments: readonly QrSegment[], version: number, level: QrErrorCorrectionLevel): number[] {
	const capacityBits = dataCodewords(version, level) * QR_CODEWORD_BITS;
	const buffer = new QrBitBuffer();
	for (const segment of segments) {
		buffer.appendBits(QR_MODE_INDICATOR[segment.mode], QR_MODE_INDICATOR_BITS);
		buffer.appendBits(segment.characterCount, characterCountBits(segment.mode, version));
		for (let bit = 0; bit < segment.data.length; bit += 1) buffer.appendBits(segment.data.bitAt(bit) ? 1 : 0, 1);
	}
	if (buffer.length > capacityBits) throw new RangeError(`Segments take ${String(buffer.length)} bits; version ${String(version)}-${level} holds ${String(capacityBits)}`);
	buffer.appendBits(0, Math.min(MAX_TERMINATOR_BITS, capacityBits - buffer.length));
	buffer.appendBits(0, (QR_CODEWORD_BITS - (buffer.length % QR_CODEWORD_BITS)) % QR_CODEWORD_BITS);
	const codewords = buffer.toCodewords();
	const [firstPad, secondPad] = PAD_CODEWORDS;
	for (let padIndex = 0; codewords.length * QR_CODEWORD_BITS < capacityBits; padIndex += 1) codewords.push(padIndex % PAD_CODEWORDS.length === 0 ? firstPad : secondPad);
	return codewords;
}

/** One error-correction block: its share of the data codewords and their Reed–Solomon codewords. */
interface QrBlock {
	readonly data: readonly number[];
	readonly errorCorrection: readonly number[];
}

/** Codeword `index` of each block, in block order, skipping blocks too short to have one. */
function columnOf(blocks: readonly (readonly number[])[], index: number): number[] {
	return blocks.flatMap((block: readonly number[]): number[] => {
		const codeword = block[index];
		return codeword === undefined ? [] : [codeword];
	});
}

/**
 * Splits `data` into the error-correction blocks of `version` at `level`, computes each
 * block's Reed–Solomon codewords and interleaves the result (ISO/IEC 18004 §7.6): the
 * first data codeword of every block, then the second, …, then the error-correction
 * codewords the same way. The later ("long") blocks carry one more data codeword.
 */
export function addErrorCorrectionAndInterleave(data: readonly number[], version: number, level: QrErrorCorrectionLevel): number[] {
	const blockCount = ecBlockCount(version, level);
	const ecLength = ecCodewordsPerBlock(version, level);
	const total = totalCodewords(version);
	const shortBlockCount = blockCount - (total % blockCount);
	const shortBlockDataLength = Math.floor(total / blockCount) - ecLength;
	const generator = reedSolomonGenerator(ecLength);

	const blocks: QrBlock[] = [];
	let offset = 0;
	for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
		const length = shortBlockDataLength + (blockIndex < shortBlockCount ? 0 : 1);
		const blockData = data.slice(offset, offset + length);
		offset += length;
		blocks.push({ data: blockData, errorCorrection: reedSolomonRemainder(blockData, generator) });
	}

	const interleaved: number[] = [];
	for (let index = 0; index <= shortBlockDataLength; index += 1)
		interleaved.push(
			...columnOf(
				blocks.map((block: QrBlock): readonly number[] => block.data),
				index,
			),
		);
	for (let index = 0; index < ecLength; index += 1)
		interleaved.push(
			...columnOf(
				blocks.map((block: QrBlock): readonly number[] => block.errorCorrection),
				index,
			),
		);
	return interleaved;
}
