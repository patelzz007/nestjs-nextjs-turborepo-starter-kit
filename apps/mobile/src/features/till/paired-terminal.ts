// The till this phone is paired as (features/till): the terminal's API key and
// id, which every redemption call presents, plus the names shown on the till
// screen. Kept in Secure Store (rules/04 — a machine credential, like the
// session tokens), one declared entry per field. A till is the merchant's
// device, not the signed-in person's: signing out leaves it paired; only
// "Unpair this phone" (or a key the API refuses) forgets it.

import type { PosTerminalCredentials } from "@workspace/api-client";
import type { PosPairedTerminal } from "@workspace/shared";

import { deleteSecureValue, readSecureValue, SECURE_STORE_ENTRIES, writeSecureValue } from "../../lib/secure-store";

export interface PairedTerminal {
	readonly credentials: PosTerminalCredentials;
	readonly terminalName: string;
	readonly locationName: string;
	readonly organizationName: string;
}

/** What the pairing call returned, as the till keeps it. */
export function pairedTerminalOf(paired: PosPairedTerminal): PairedTerminal {
	return {
		credentials: { apiKey: paired.apiKey, terminalId: paired.terminalId },
		terminalName: paired.terminalName,
		locationName: paired.location.name,
		organizationName: paired.organization.displayName,
	};
}

const TILL_ENTRIES = [
	SECURE_STORE_ENTRIES.tillApiKey,
	SECURE_STORE_ENTRIES.tillTerminalId,
	SECURE_STORE_ENTRIES.tillTerminalName,
	SECURE_STORE_ENTRIES.tillLocationName,
	SECURE_STORE_ENTRIES.tillOrganizationName,
];

/** Forgets the pairing: every entry, so no half of it is left behind. */
export async function forgetPairedTerminal(): Promise<void> {
	await Promise.all(TILL_ENTRIES.map((entry): Promise<void> => deleteSecureValue(entry)));
}

/**
 * The till this phone is paired as, or `null`. A pairing missing any field (an
 * interrupted save, a corrupt entry) is forgotten whole and reads as unpaired.
 *
 * @throws {SecureStoreUnavailableError} when the store itself cannot be read.
 */
export async function readPairedTerminal(): Promise<PairedTerminal | null> {
	const [apiKey, terminalId, terminalName, locationName, organizationName] = await Promise.all([
		readSecureValue(SECURE_STORE_ENTRIES.tillApiKey),
		readSecureValue(SECURE_STORE_ENTRIES.tillTerminalId),
		readSecureValue(SECURE_STORE_ENTRIES.tillTerminalName),
		readSecureValue(SECURE_STORE_ENTRIES.tillLocationName),
		readSecureValue(SECURE_STORE_ENTRIES.tillOrganizationName),
	]);
	if (apiKey === null && terminalId === null && terminalName === null && locationName === null && organizationName === null) {
		return null;
	}
	if (apiKey === null || terminalId === null || terminalName === null || locationName === null || organizationName === null) {
		await forgetPairedTerminal();
		return null;
	}
	return { credentials: { apiKey, terminalId }, terminalName, locationName, organizationName };
}

/** Keeps the pairing; the API key is written last, so an interrupted save never leaves a usable key without its terminal. */
export async function savePairedTerminal(terminal: PairedTerminal): Promise<void> {
	await Promise.all([
		writeSecureValue(SECURE_STORE_ENTRIES.tillTerminalId, terminal.credentials.terminalId),
		writeSecureValue(SECURE_STORE_ENTRIES.tillTerminalName, terminal.terminalName),
		writeSecureValue(SECURE_STORE_ENTRIES.tillLocationName, terminal.locationName),
		writeSecureValue(SECURE_STORE_ENTRIES.tillOrganizationName, terminal.organizationName),
	]);
	await writeSecureValue(SECURE_STORE_ENTRIES.tillApiKey, terminal.credentials.apiKey);
}
