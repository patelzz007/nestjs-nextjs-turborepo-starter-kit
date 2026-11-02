// ============================================
// notifications/domain/policies/sms-segments.ts — what an SMS costs (ADR 070)
// ============================================
// GSM-7 holds 160 characters in one segment (153 per segment when split); any character outside it
// turns the whole message into UCS-2: 70, then 67. The catalog test fails a type whose rendering needs
// more segments than it declares.

const GSM7_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
/** Extension characters cost two septets (escape + character). */
const GSM7_EXTENSION = "^{}\\[~]|€\f";
const GSM7_SINGLE = 160;
const GSM7_MULTI = 153;
const UCS2_SINGLE = 70;
const UCS2_MULTI = 67;

export interface SmsSegmentCount {
	readonly encoding: "GSM-7" | "UCS-2";
	readonly units: number;
	readonly segments: number;
}

export function countSmsSegments(text: string): SmsSegmentCount {
	const characters = Array.from(text);
	const isGsm7 = characters.every((character: string): boolean => GSM7_BASIC.includes(character) || GSM7_EXTENSION.includes(character));
	if (isGsm7) {
		const units = characters.reduce((total: number, character: string): number => total + (GSM7_EXTENSION.includes(character) ? 2 : 1), 0);
		return { encoding: "GSM-7", units, segments: units <= GSM7_SINGLE ? 1 : Math.ceil(units / GSM7_MULTI) };
	}
	const units = characters.reduce((total: number, character: string): number => total + (character.length > 1 ? 2 : 1), 0);
	return { encoding: "UCS-2", units, segments: units <= UCS2_SINGLE ? 1 : Math.ceil(units / UCS2_MULTI) };
}
