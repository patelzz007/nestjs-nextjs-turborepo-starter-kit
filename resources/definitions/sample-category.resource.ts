import { defineResource } from "@workspace/cli";

export default defineResource({
	version: 1,
	name: "SampleCategory",
	model: {
		name: "SampleCategory",
		softDelete: true,
		concurrency: false,
		idempotency: false,
		rls: "admin-only",
		fields: {
			name: {
				type: "string",
				required: true,
				searchable: true,
				sortable: true,
			},
			slug: {
				type: "string",
				required: true,
				searchable: true,
				sortable: true,
			},
			description: {
				type: "text",
				nullable: true,
			},
			sortOrder: {
				type: "int",
				default: 0,
				sortable: true,
			},
			isActive: {
				type: "boolean",
				default: true,
				filterable: true,
			},
		},
	},
	permissions: {
		create: true,
		read: true,
		update: true,
		delete: true,
		list: true,
	},
	admin: {
		navigation: {
			label: "Categories",
			group: "Platform",
			icon: "FolderTree",
			hiddenInProduction: true,
		},
		list: {
			searchable: ["name", "slug"],
			sortable: ["name", "slug", "sortOrder", "createdAt"],
			filters: ["isActive"],
			columns: ["name", "slug", "sortOrder", "isActive", "createdAt"],
		},
		form: {
			layout: "two-column",
			fields: ["name", "slug", "description", "sortOrder", "isActive"],
		},
	},
});
