import { fastify, type FastifyRequest } from "fastify";

/**
 * Real `FastifyRequest` produced by routing an injected request through a
 * throwaway Fastify instance — for unit tests that call controller methods
 * directly with `@Req()`-typed arguments.
 */
export async function captureFastifyRequest(options: { readonly headers: Record<string, string>; readonly payload?: string }): Promise<FastifyRequest> {
	const app = fastify();
	const holder: { request?: FastifyRequest } = {};
	app.post("/capture", (request) => {
		holder.request = request;
		return Promise.resolve({});
	});
	await app.inject({ method: "POST", url: "/capture", headers: options.headers, ...(options.payload === undefined ? {} : { payload: options.payload }) });
	await app.close();
	if (holder.request === undefined) {
		throw new Error("Fastify did not route the capture request");
	}
	return holder.request;
}
