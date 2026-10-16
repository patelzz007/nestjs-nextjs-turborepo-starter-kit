import * as React from "react";
import { HouseIcon } from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
import { Card, CardContent } from "@workspace/ui/components/card";
import { BREADCRUMB_SAMPLE_HREF } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-sample";

export function Breadcrumb9Example(): React.JSX.Element {
	return (
		<Card className="p-2">
			<CardContent className="px-1 py-0">
				<Breadcrumb>
					<BreadcrumbList className="gap-1.5 sm:gap-1.5">
						<BreadcrumbItem>
							<BreadcrumbLink href={BREADCRUMB_SAMPLE_HREF} className="flex items-center gap-1.5">
								<HouseIcon className="size-4" aria-hidden="true" />
								Home
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink href={BREADCRUMB_SAMPLE_HREF}>Products</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage className="font-semibold">Checkout</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</CardContent>
		</Card>
	);
}
