import type { ProviderHttp, ProviderHttpRequest } from "../provider-http";

/** One recorded gateway call. */
export interface RecordedCall {
	readonly url: string;
	readonly request: ProviderHttpRequest;
}

/** A gateway that answers each call with the next scripted response, recording what it was sent. */
export function scriptedHttp(responses: readonly { readonly status: number; readonly body: string }[]): { readonly http: ProviderHttp; readonly calls: RecordedCall[] } {
	const calls: RecordedCall[] = [];
	const queue = [...responses];
	const http: ProviderHttp = (url, request) => {
		calls.push({ url, request });
		const next = queue.shift();
		return next === undefined ? Promise.reject(new Error("no scripted response left")) : Promise.resolve({ status: next.status, text: next.body });
	};
	return { http, calls };
}
