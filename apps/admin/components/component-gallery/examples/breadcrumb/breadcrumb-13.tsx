import * as React from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
import { BREADCRUMB_SAMPLE_HREF } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-sample";

function BulletSeparator(): React.JSX.Element {
	return <span className="inline-flex h-0.5 w-2 shrink-0 rounded-full bg-foreground/30" />;
}

export function Breadcrumb13Example(): React.JSX.Element {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink href={BREADCRUMB_SAMPLE_HREF}>Home</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator className="flex items-center">
					<BulletSeparator />
				</BreadcrumbSeparator>
				<BreadcrumbItem>
					<BreadcrumbLink href={BREADCRUMB_SAMPLE_HREF}>Components</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator className="flex items-center">
					<BulletSeparator />
				</BreadcrumbSeparator>
				<BreadcrumbItem>
					<BreadcrumbPage>Breadcrumb</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
