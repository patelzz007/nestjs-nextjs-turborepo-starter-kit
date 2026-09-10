/** JWTs are three base64url segments separated by dots. */
export function isJwtShapedToken(token: string): boolean {
	return token.split(".").length === 3;
}
