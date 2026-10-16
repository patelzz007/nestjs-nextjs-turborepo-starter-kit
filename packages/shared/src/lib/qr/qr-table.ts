import { QrTableLookupError } from "./qr-errors";

/**
 * `table[index]`, or a {@link QrTableLookupError} naming the table. The encoder's tables are
 * fixed and its indices come from validated options, so a miss is a bug — never a silent
 * `undefined` that would quietly become a light module or a zero codeword.
 */
export function readTableEntry(table: ArrayLike<number>, index: number, tableName: string): number {
	const entry = table[index];
	if (entry === undefined) throw new QrTableLookupError(tableName, index);
	return entry;
}
