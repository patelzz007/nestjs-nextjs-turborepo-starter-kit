import type { Request } from "express";

/**
 * Extract client device information and IP address from an Express request.
 *
 * @param req - The Express Request object
 * @returns An object with `deviceInfo` (User-Agent string) and `ipAddress`
 */
export const extractClientInfo = (req: Request): { deviceInfo: string | undefined; ipAddress: string | undefined } => {
	const deviceInfo: string | undefined = req.headers["user-agent"];
	// Trust the X-Forwarded-For header if behind a reverse proxy, fall back to req.ip
	const ipAddress: string | undefined = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip;

	return { deviceInfo, ipAddress };
};
