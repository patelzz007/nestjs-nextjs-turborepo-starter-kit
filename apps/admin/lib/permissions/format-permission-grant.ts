/** Human-readable label for a permission-check grant `via` field. */
export function formatPermissionGrantVia(via: string): string {
	switch (via) {
		case "super_admin":
			return "Super admin";
		case "direct":
			return "Direct grant";
		case "role":
			return "Role";
		default:
			return via;
	}
}
