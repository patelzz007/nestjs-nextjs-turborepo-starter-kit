/** Characters of the local part kept visible: short addresses keep only their first character. */
const SHORT_LOCAL_PART_MAX_LENGTH = 3;
const SHORT_LOCAL_PART_VISIBLE = 1;
const LONG_LOCAL_PART_VISIBLE = 3;

/** PII-safe recipient for logs: "jamie@example.com" → "jam***@example.com". */
export function maskEmail(email: string): string {
	const atIndex: number = email.indexOf("@");
	if (atIndex <= 0) {
		return "***";
	}
	const local: string = email.slice(0, atIndex);
	const domain: string = email.slice(atIndex);
	const visible: string = local.length <= SHORT_LOCAL_PART_MAX_LENGTH ? local.slice(0, SHORT_LOCAL_PART_VISIBLE) : local.slice(0, LONG_LOCAL_PART_VISIBLE);
	return `${visible}***${domain}`;
}
