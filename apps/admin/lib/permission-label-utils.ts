function normalizePermissionLabel(value: string): string {
	return value.toLowerCase().replace(/[\s_-]+/g, "");
}

/** True when a resource row would repeat the group name (e.g. Analytics → ANALYTICS). */
export function isRedundantResourceLabel(groupName: string, resource: string): boolean {
	const normalizedGroup: string = normalizePermissionLabel(groupName);
	const normalizedResource: string = normalizePermissionLabel(resource);
	return normalizedGroup === normalizedResource || normalizedGroup.includes(normalizedResource) || normalizedResource.includes(normalizedGroup);
}
