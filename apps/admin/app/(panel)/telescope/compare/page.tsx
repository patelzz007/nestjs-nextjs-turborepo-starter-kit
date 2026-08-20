import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeCompareView from "./request-compare";

export const dynamic = "force-dynamic";

/** `/telescope/compare?a=&b=` — request diff. */
export default async function TelescopeComparePage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const sp = await searchParams;
	const idA: string | null = typeof sp.a === "string" && sp.a.length > 0 ? sp.a : null;
	const idB: string | null = typeof sp.b === "string" && sp.b.length > 0 ? sp.b : null;

	let envelope: React.ComponentProps<typeof TelescopeCompareView>["initialEnvelope"] = undefined;
	if (idA !== null && idB !== null) {
		const server = createServerCaller();
		envelope = await server.telescope.compare.query({ a: idA, b: idB });
	}

	return <TelescopeCompareView initialEnvelope={envelope} />;
}
