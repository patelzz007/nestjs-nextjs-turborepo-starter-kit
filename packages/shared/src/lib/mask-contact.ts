// What a log or a merchant's customer list may show of someone's contact details: enough to tell
// people apart, never the address itself.

const VISIBLE_PHONE_TAIL = 4;
const VISIBLE_PHONE_HEAD = 3;
const MASK = "••••";

/** `+60••••6789`. */
export function maskPhone(e164: string): string {
	return `${e164.slice(0, VISIBLE_PHONE_HEAD)}${MASK}${e164.slice(-VISIBLE_PHONE_TAIL)}`;
}

/** `j•••@example.com`. */
export function maskEmailAddress(address: string): string {
	const at = address.lastIndexOf("@");
	if (at <= 0) {
		return MASK;
	}
	return `${address.slice(0, 1)}•••${address.slice(at)}`;
}
