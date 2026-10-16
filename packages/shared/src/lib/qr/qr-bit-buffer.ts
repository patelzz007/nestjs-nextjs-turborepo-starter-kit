/** Bits in one QR codeword. */
export const QR_CODEWORD_BITS = 8;

/** Most bits {@link QrBitBuffer.appendBits} takes at once: JavaScript's bitwise operators work on 32-bit integers. */
const MAX_APPEND_BITS = 31;

/** An append-only sequence of bits, most significant bit first — the encoder's data stream before it becomes codewords. */
export class QrBitBuffer {
	private readonly _bits: boolean[] = [];

	/** How many bits the buffer holds. */
	public get length(): number {
		return this._bits.length;
	}

	/**
	 * Appends the low `bitCount` bits of `value`, most significant first. `value` must be a
	 * non-negative integer below 2^bitCount — a wider value is a bug in the caller, so it throws.
	 */
	public appendBits(value: number, bitCount: number): void {
		if (bitCount < 0 || bitCount > MAX_APPEND_BITS || value < 0 || value >>> bitCount !== 0) {
			throw new RangeError(`Cannot append ${String(value)} as ${String(bitCount)} bits`);
		}
		for (let bit = bitCount - 1; bit >= 0; bit -= 1) this._bits.push(((value >>> bit) & 1) === 1);
	}

	/** The bit at `index` (`false` past the end). */
	public bitAt(index: number): boolean {
		return this._bits[index] === true;
	}

	/** The buffer packed into bytes, most significant bit first; a final partial byte is padded with zero bits. */
	public toCodewords(): number[] {
		const codewords: number[] = [];
		for (let start = 0; start < this._bits.length; start += QR_CODEWORD_BITS) {
			let codeword = 0;
			for (let offset = 0; offset < QR_CODEWORD_BITS; offset += 1) codeword = (codeword << 1) | (this.bitAt(start + offset) ? 1 : 0);
			codewords.push(codeword);
		}
		return codewords;
	}
}
