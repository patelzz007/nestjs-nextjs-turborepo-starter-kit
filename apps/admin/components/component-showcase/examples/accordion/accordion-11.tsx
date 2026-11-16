import * as React from "react";
import { CircleCheckIcon, QrCodeIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";

export function Accordion11Example(): React.JSX.Element {
	return (
		<div className="mx-auto mb-auto w-full max-w-lg">
			<Accordion multiple={false} defaultValue={["pos-app"]} className="overflow-hidden rounded-lg border border-border">
				{/* Step 1: Completed */}
				<AccordionItem value="add-products" className="bg-transparent px-4">
					<AccordionTrigger className="items-center py-4 font-semibold hover:no-underline">
						<div className="flex w-full items-center justify-between pr-4">
							<div className="flex items-center justify-center gap-3">
								<div className="flex size-5 items-center justify-center">
									<CircleCheckIcon className="size-5 fill-success text-background" />
								</div>
								<span className="text-sm font-medium">Add products</span>
							</div>
							<Badge variant="success-light">Ready</Badge>
						</div>
					</AccordionTrigger>
					<AccordionContent className="pr-0 pb-4 pl-8 leading-relaxed text-muted-foreground">
						Your products have been successfully added and are ready for sale.
					</AccordionContent>
				</AccordionItem>

				{/* Step 2: Expanded/In Progress */}
				<AccordionItem value="pos-app" className="bg-transparent px-4">
					<AccordionTrigger className="items-center py-4 font-semibold hover:no-underline">
						<div className="flex w-full items-center justify-between pr-4">
							<div className="flex items-center gap-3">
								<div className="flex size-5 items-center justify-center rounded-full bg-tone-yellow-soft">
									<div className="size-2 rounded-full bg-tone-yellow" />
								</div>
								<span className="text-sm font-medium text-foreground">Get the point of sale application</span>
							</div>
						</div>
					</AccordionTrigger>
					<AccordionContent className="pt-2 pl-8">
						<div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
							<div className="flex-1 space-y-6">
								<p className="text-sm leading-relaxed text-muted-foreground">
									Scan the QR code or send yourself the link to get the app. The mobile app is where you&apos;ll manage orders, track inventory, and view analytics on the go.
								</p>
								<ButtonGroup>
									<Input placeholder="james@alignui.com" />
									<Button variant="outline" aria-label="Send link">
										Send link
									</Button>
								</ButtonGroup>
							</div>
							<div className="flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 p-3">
								<QrCodeIcon className="size-20" strokeWidth={1.5} />
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Step 3: Pending */}
				<AccordionItem value="price-stock" className="bg-transparent px-4">
					<AccordionTrigger className="items-center py-4 font-semibold hover:no-underline">
						<div className="flex w-full items-center justify-between pr-4">
							<div className="flex items-center gap-3">
								<div className="flex size-5 items-center justify-center">
									<Spinner className="opacity-60" />
								</div>
								<span className="text-sm font-medium text-muted-foreground">Product price & stock</span>
							</div>
						</div>
					</AccordionTrigger>
					<AccordionContent className="pl-8 text-sm leading-relaxed text-muted-foreground">
						Configure your product pricing and manage stock levels across all locations.
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
