import type { FastifyRequest } from "fastify";
import { ForwardedForHeaderSchema } from "@workspace/shared";

/**
 * Extract client device information and IP address from a Fastify request.
 *
 * @param req - The FastifyRequest object
 * @returns An object with `deviceInfo` (User-Agent string) and `ipAddress`
 */
export const extractClientInfo = (req: FastifyRequest): { deviceInfo: string | undefined; ipAddress: string | undefined } => {
	const deviceInfo: string | undefined = req.headers["user-agent"];
	// Trust the X-Forwarded-For header if behind a reverse proxy, fall back to req.ip
	const forwardedParsed = ForwardedForHeaderSchema.safeParse(req.headers["x-forwarded-for"]);
	const forwardedRaw = forwardedParsed.success ? forwardedParsed.data : undefined;
	const forwardedStr: string = forwardedRaw !== undefined ? (Array.isArray(forwardedRaw) ? (forwardedRaw[0] ?? "") : forwardedRaw) : "";
	const ipAddress: string | undefined = forwardedStr.length > 0 ? forwardedStr.split(",")[0]?.trim() : req.ip;

	return { deviceInfo, ipAddress };
};
