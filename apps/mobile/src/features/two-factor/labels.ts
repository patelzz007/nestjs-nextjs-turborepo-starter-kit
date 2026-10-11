// What the two-factor enrollment screen is called, per mode — read by the app
// header (features/navigation/app-screens.ts).

import type { TwoFactorEnrollmentMode } from "./two-factor-enrollment";

const ENROLLMENT_TITLES: Readonly<Record<TwoFactorEnrollmentMode, string>> = {
	setup: "Turn on two-factor authentication",
	rotate: "New backup codes",
};

export function twoFactorEnrollmentTitleOf(mode: TwoFactorEnrollmentMode): string {
	return ENROLLMENT_TITLES[mode];
}
