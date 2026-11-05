import { createFileRoute } from "@tanstack/react-router";

/** Every API operation for the endpoint explorer (`/endpoints`), built at pre-render time. */
export const Route = createFileRoute("/api-endpoints.json")({
	server: {
		handlers: {
			GET: async (): Promise<Response> => {
				const { endpointIndex } = await import("../server/content.server");
				return Response.json(endpointIndex());
			},
		},
	},
});
