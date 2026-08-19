import { FastifyQuerySchema, HttpHeaderValueSchema, ReplyHeaderValueSchema } from "@workspace/shared";

/** Returns the first non-empty header value, if present. */
export function readFirstHeader(value: string | string[] | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	const parsed = HttpHeaderValueSchema.safeParse(value);
	if (!parsed.success) {
		return undefined;
	}
	if (Array.isArray(parsed.data)) {
		const first: string | undefined = parsed.data[0];
		return first !== undefined && first.length > 0 ? first : undefined;
	}
	return parsed.data.length > 0 ? parsed.data : undefined;
}

/** Reads one query parameter as a string (first value when repeated). */
export function readQueryParam(query: unknown, name: string): string | undefined {
	const parsed = FastifyQuerySchema.safeParse(query);
	if (!parsed.success) {
		return undefined;
	}
	return readFirstHeader(parsed.data[name]);
}

/** Reads a reply header as a string when possible. */
export function readReplyHeader(value: string | number | string[] | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	const parsed = ReplyHeaderValueSchema.safeParse(value);
	if (!parsed.success) {
		return undefined;
	}
	if (Array.isArray(parsed.data)) {
		return readFirstHeader(parsed.data);
	}
	return String(parsed.data);
}
