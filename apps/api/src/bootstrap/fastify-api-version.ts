/** Extract the version segment of a versioned URL (`"/api/v1/foo"` → `"v1"`). */
export function apiVersionOfUrl(url: string): string | undefined {
	const match: RegExpExecArray | null = /\/api\/(v\d+)\//.exec(url);
	return match?.[1];
}
