import { JsonValueSchema, type JsonValue } from "@workspace/shared";

// The one HTTP seam the payment adapters call through: Node's `fetch` in production, a recording fake in
// tests (no test reaches a real gateway). Every call has a timeout, so a slow gateway can't hold a request.

/** How long one gateway call may take. */
export const PROVIDER_REQUEST_TIMEOUT_MS = 15_000;

export interface ProviderHttpRequest {
	readonly method: "GET" | "POST";
	readonly headers: Readonly<Record<string, string>>;
	readonly body?: string;
}

export interface ProviderHttpResponse {
	readonly status: number;
	readonly text: string;
}

export type ProviderHttp = (url: string, request: ProviderHttpRequest) => Promise<ProviderHttpResponse>;

/** The real seam: `fetch` with the timeout. */
export const fetchProviderHttp: ProviderHttp = async (url, request) => {
	const response = await fetch(url, {
		method: request.method,
		headers: request.headers,
		body: request.body ?? null,
		signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
	});
	return { status: response.status, text: await response.text() };
};

/** Whether a status code is a success. */
export function isSuccessStatus(status: number): boolean {
	return status >= 200 && status < 300;
}

/** A gateway's answer as JSON, or null when it isn't JSON at all (an HTML error page, an empty body). */
export function parseJsonBody(text: string): JsonValue | null {
	try {
		const parsed = JsonValueSchema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}
