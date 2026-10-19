import { randomInt } from "node:crypto";

/** Characters a person can read out and type without confusion: no 0/O and no 1/I. */
export const UNAMBIGUOUS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A uniformly random code of `length` characters from {@link UNAMBIGUOUS_CODE_ALPHABET} (claim backup codes, pairing codes, terminal ids). */
export function unambiguousCode(length: number): string {
	let code = "";
	for (let index = 0; index < length; index += 1) {
		code += UNAMBIGUOUS_CODE_ALPHABET.charAt(randomInt(0, UNAMBIGUOUS_CODE_ALPHABET.length));
	}
	return code;
}
