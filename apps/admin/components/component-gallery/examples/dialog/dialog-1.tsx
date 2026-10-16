"use client";

import * as React from "react";
import { useCallback, useId, useState } from "react";
import { z } from "zod";

import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

const ProfileSchema = z.object({ name: z.string(), username: z.string() });

export function Dialog1Example(): React.JSX.Element {
	const id = useId();
	const [open, setOpen] = useState(false);
	const [profile, setProfile] = useState<z.infer<typeof ProfileSchema>>({
		name: "Pedro Duarte",
		username: "@peduarte",
	});

	const handleSubmit = useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();
		// Form fields are untyped `FormDataEntryValue`s: parse them into the profile shape.
		const parsed = ProfileSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
		if (parsed.success) {
			setProfile(parsed.data);
			setOpen(false);
		}
	}, []);

	return (
		<div className="flex items-center justify-center">
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger render={<Button variant="outline" />}>Basic Dialog</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit profile</DialogTitle>
						<DialogDescription>Make changes to your profile here. Click save when you&apos;re done. Your profile will be updated immediately.</DialogDescription>
					</DialogHeader>
					{/* The form sits inside the portaled content so Save can submit it. */}
					<form onSubmit={handleSubmit} className="contents">
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
								<Input id={`${id}-name`} name="name" defaultValue={profile.name} />
							</Field>
							<Field>
								<FieldLabel htmlFor={`${id}-username`}>Username</FieldLabel>
								<Input id={`${id}-username`} name="username" defaultValue={profile.username} />
							</Field>
						</FieldGroup>
						<DialogFooter>
							<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
							<Button type="submit">Save changes</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
