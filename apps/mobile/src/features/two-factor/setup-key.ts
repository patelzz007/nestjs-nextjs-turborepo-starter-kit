// The authenticator setup key, grouped for reading aloud or typing by hand.

/** Characters per group: `JBSW Y3DP EHPK 3PXP`. */
const SETUP_KEY_GROUP_SIZE = 4;

export function groupSetupKey(secret: string): string {
	const groups: string[] = [];
	for (let start = 0; start < secret.length; start += SETUP_KEY_GROUP_SIZE) {
		groups.push(secret.slice(start, start + SETUP_KEY_GROUP_SIZE));
	}
	return groups.join(" ");
}
