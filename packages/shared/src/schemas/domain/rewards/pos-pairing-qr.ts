import { z } from "zod";

import { PosPairingCodeSchema, type PosPairingCode } from "./rewards-entities";

/**
 * What the merchant console's pairing QR encodes: a versioned prefix, then the
 * one-time pairing code (`pos-pair:v1:ABCD2345`). The prefix tells a till's
 * scanner a pairing code apart from a customer's redemption QR (a bare token),
 * and the version lets the format change without old tills misreading it.
 */
export const POS_PAIRING_QR_PREFIX = "pos-pair:v1:";

/** The whole payload: the prefix, then exactly one pairing code. */
const POS_PAIRING_QR_PATTERN = /^pos-pair:v1:(?<pairingCode>[A-Z0-9]+)$/u;

/** A scanned pairing QR, parsed to the pairing code it carries. Anything else fails to parse. */
export const PosPairingQrPayloadSchema = z
	.string()
	.trim()
	.regex(POS_PAIRING_QR_PATTERN, "Not a terminal pairing QR code")
	.transform((payload: string): string | undefined => POS_PAIRING_QR_PATTERN.exec(payload)?.groups?.pairingCode)
	.pipe(PosPairingCodeSchema);

/** The text of the pairing QR the merchant console shows for `pairingCode`. */
export function buildPosPairingQrPayload(pairingCode: PosPairingCode): string {
	return `${POS_PAIRING_QR_PREFIX}${pairingCode}`;
}
