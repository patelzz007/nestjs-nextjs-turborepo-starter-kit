// When to warn that backup codes are running low (§10.3, §10.10).

/** At or below this many unused codes, the app suggests generating new ones. */
export const LOW_BACKUP_CODES_THRESHOLD = 3;

export function backupCodesNotice(remaining: number): string | null {
	if (remaining === 0) {
		return "You have no backup codes left. Generate new ones in Security settings so you can still sign in if you lose your authenticator.";
	}
	if (remaining <= LOW_BACKUP_CODES_THRESHOLD) {
		return `Only ${String(remaining)} backup ${remaining === 1 ? "code is" : "codes are"} left. Generate new ones in Security settings.`;
	}
	return null;
}
