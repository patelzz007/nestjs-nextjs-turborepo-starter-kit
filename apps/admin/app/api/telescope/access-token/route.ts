import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACCESS_TOKEN_COOKIE = "adminAccessToken";

/** Exposes the admin access token for copy-to-clipboard snippets (cURL / fetch). */
export function GET(request: NextRequest): Response {
	const accessToken: string | undefined = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	if (accessToken === undefined) {
		return Response.json({ message: "Not authenticated." }, { status: 401 });
	}
	return Response.json({ accessToken });
}
