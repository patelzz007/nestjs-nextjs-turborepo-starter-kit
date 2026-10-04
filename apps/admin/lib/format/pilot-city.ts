import type { PilotCity } from "@workspace/shared";

/** Display name of every pilot city — the one place the admin app spells them out. */
export const PILOT_CITY_LABELS: Readonly<Record<PilotCity, string>> = {
	KUALA_LUMPUR: "Kuala Lumpur",
	MELAKA: "Melaka",
};

/** `"KUALA_LUMPUR"` → `"Kuala Lumpur"`. */
export function pilotCityLabel(city: PilotCity): string {
	return PILOT_CITY_LABELS[city];
}
