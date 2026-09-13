const LOCATION_NAME_SEPARATOR = " — ";

interface LocationLabelSource {
	readonly name: string;
	readonly code: string;
}

/** Compact store label for topbars — drops redundant org prefix when present. */
export function resolveLocationShortLabel(location: LocationLabelSource): string {
	const separatorIndex = location.name.lastIndexOf(LOCATION_NAME_SEPARATOR);

	if (separatorIndex >= 0) {
		const suffix = location.name.slice(separatorIndex + LOCATION_NAME_SEPARATOR.length).trim();

		if (suffix.length > 0) {
			return suffix;
		}
	}

	return formatLocationCodeLabel(location.code);
}

function formatLocationCodeLabel(code: string): string {
	return code
		.split("-")
		.filter((part) => part.length > 0)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}
