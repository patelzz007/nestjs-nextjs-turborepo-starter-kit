// Saved views on admin lists (enhancement 5.10): the super admin's own views (one shared with the other staff),
// a Platform Developer's shared view the super admin sees, and one removed view (soft-deleted).

import type { Prisma } from "@prisma/client";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";

const NAMESPACE = "saved-views";

export async function seedSavedViews(now: number): Promise<number> {
	const superAdmin = await prisma.user.findFirstOrThrow({ where: { email: "superadmin@example.com", isDeleted: false }, select: { id: true } });
	const developer = await prisma.user.findFirstOrThrow({ where: { email: "developer@example.com", isDeleted: false }, select: { id: true } });
	const view = (
		key: string,
		userId: string,
		fields: Omit<Prisma.SavedListViewUncheckedCreateInput, "id" | "userId" | "createdBy" | "updatedBy">,
	): Prisma.SavedListViewUncheckedCreateInput => ({
		id: deterministicUuid(NAMESPACE, key),
		userId,
		createdBy: userId,
		updatedBy: userId,
		...fields,
	});
	const views: Prisma.SavedListViewUncheckedCreateInput[] = [
		view("admin:active-users", superAdmin.id, { listKey: "admin.users", name: "Active accounts", query: "?filter[status]=active", shared: true }),
		view("admin:locked-users", superAdmin.id, { listKey: "admin.users", name: "Locked out", query: "?filter[status]=locked", shared: false }),
		view("admin:failed-requests", superAdmin.id, { listKey: "admin.audit-logs", name: "Failed requests", query: "?filter[outcome]=FAILURE", shared: false }),
		view("developer:background", developer.id, { listKey: "admin.audit-logs", name: "Background changes", query: "?filter[kind]=BACKGROUND", shared: true }),
		view("admin:removed", superAdmin.id, {
			listKey: "admin.users",
			name: "Old filter",
			query: "",
			shared: false,
			isDeleted: true,
			deletedAt: BigInt(now - 86_400_000),
			deletedBy: superAdmin.id,
		}),
	];
	for (const entry of views) {
		await prisma.savedListView.upsert({ where: { id: entry.id ?? "" }, update: {}, create: entry });
	}
	return views.length;
}
