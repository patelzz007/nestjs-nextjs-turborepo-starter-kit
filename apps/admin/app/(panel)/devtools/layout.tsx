import { notFound } from "next/navigation";
import { hasCapability, SessionPermissionsResponseSchema, toPlatformCapabilitySlug } from "@workspace/shared";

import { AdminAccessDenied } from "@/components/access/admin-access-denied";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { isGeneratorUiEnabled } from "@/lib/generator/guard";

const GENERATOR_MANAGE_CAPABILITY = toPlatformCapabilitySlug("MANAGE", "DEVTOOLS");

export interface DevToolsLayoutProps {
	readonly children: React.ReactNode;
}

export default async function DevToolsLayout({ children }: DevToolsLayoutProps): Promise<React.JSX.Element> {
	if (!isGeneratorUiEnabled()) {
		notFound();
	}

	const server = createAdminServerCaller();
	const response = await server.auth.permissions.query(undefined);
	const parsed = SessionPermissionsResponseSchema.safeParse(response.data);

	if (!parsed.success || !parsed.data.hasAdminAccess || !hasCapability(parsed.data.capabilities, GENERATOR_MANAGE_CAPABILITY)) {
		return (
			<AdminAccessDenied
				title="Generator access required"
				description="You need the platform:devtools.manage capability to use the resource generator. Ask a super administrator to grant Developer Tools manage permission."
			/>
		);
	}

	return <>{children}</>;
}
