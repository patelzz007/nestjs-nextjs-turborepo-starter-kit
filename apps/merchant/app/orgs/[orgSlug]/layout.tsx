import { organizationPath, ORGANIZATION_SLUG_COOKIE_NAME } from "@/lib/organization-slug";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

interface OrgLayoutProps {
	readonly children: React.ReactNode;
	readonly params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const cookieStore = await cookies();
	const storedSlug = cookieStore.get(ORGANIZATION_SLUG_COOKIE_NAME)?.value;

	if (storedSlug !== undefined && storedSlug !== orgSlug) {
		redirect(organizationPath(storedSlug));
	}

	return <>{children}</>;
}
