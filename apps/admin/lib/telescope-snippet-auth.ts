import { z } from "zod";

const SnippetAccessTokenResponseSchema = z.object({ accessToken: z.string() }).strict();

/** Reads the admin access token from the same-origin route (httpOnly cookie → snippet). */
export async function fetchSnippetAccessToken(): Promise<string | null> {
	const response: Response = await fetch("/api/telescope/access-token", { credentials: "include" });
	if (!response.ok) {
		return null;
	}
	const parsed = SnippetAccessTokenResponseSchema.safeParse(await response.json());
	if (!parsed.success) {
		return null;
	}
	return parsed.data.accessToken;
}
