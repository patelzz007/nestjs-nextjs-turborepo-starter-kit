---
title: "Adding a Feature"
tags: ["guide", "onboarding", "development", "workflow"]
description: "Step-by-step guide to adding a new feature module — from Zod schema to admin page, with a concrete example."
order: 14
author: "Acme Inc."
lastUpdated: 1787529600000
coverImage: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1600&q=80"
---

# Adding a Feature — Step-by-Step Guide

> **Goal:** Walk a new developer through adding a complete feature module (e.g., "reports") from schema to UI.

---

## Overview

Every feature follows this flow:

```
packages/shared (schema + contract)
        ↓
apps/api (controller + service + guard)
        ↓
packages/client (endpoint definition)
        ↓
apps/admin (page + components)
```

---

## Step 1: Define the Schema (`packages/shared`)

### 1a. Create the Zod schema

```ts
// packages/shared/src/schemas/domain/report.ts
import { z } from "zod";

export const ReportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export type ReportListQuery = z.output<typeof ReportListQuerySchema>;

export const ReportEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.enum(["draft", "published", "archived"]),
  createdAt: z.number(),
});

export type ReportEntry = z.output<typeof ReportEntrySchema>;

export const ReportListResponseSchema = z.object({
  reports: z.array(ReportEntrySchema),
  total: z.number(),
});

export type ReportListResponse = z.output<typeof ReportListResponseSchema>;
```

### 1b. Export from the barrel

```ts
// packages/shared/src/schemas/index.ts
export * from "./domain/report";
```

---

## Step 2: Define the API Route (`packages/shared`)

```ts
// packages/shared/src/api-routes.ts — add to the route tree
export const apiRoutes = {
  // ... existing routes ...
  report: {
    list: "/report",
    detail: { path: "/report/:id", params: ["id"] as const },
    create: "/report",
    update: { path: "/report/:id", params: ["id"] as const },
    delete: { path: "/report/:id", params: ["id"] as const },
  },
};
```

---

## Step 3: Add the Contract (`packages/shared`)

```ts
// packages/shared/src/contracts/index.ts — add to apiContract
import { ReportListQuerySchema } from "../schemas/domain/report";

export const apiContract = {
  // ... existing contracts ...
  report: {
    list: defineContract({ method: "GET", path: apiRoutes.report.list, input: ReportListQuerySchema }),
    detail: defineContract({ method: "GET", path: apiRoutes.report.detail.path, input: z.object({ id: z.string().min(1) }).strict() }),
    create: defineContract({ method: "POST", path: apiRoutes.report.create, input: ReportCreateInputSchema }),
    update: defineContract({ method: "PUT", path: apiRoutes.report.update.path, input: ReportUpdateInputSchema }),
    delete: defineContract({ method: "DELETE", path: apiRoutes.report.delete.path, input: z.object({ id: z.string().min(1) }).strict() }),
  },
};
```

---

## Step 4: Create the NestJS Module (`apps/api`)

### 4a. Create the service

```ts
// apps/api/src/modules/report/report.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { LogService } from "../logs/logs.service";
import type { ReportListQuery, ReportListResponse } from "@workspace/shared";

@Injectable()
export class ReportService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogService,
  ) {}

  public async list(query: ReportListQuery): Promise<ReportListResponse> {
    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.report.count(),
    ]);
    return { reports, total };
  }
}
```

### 4b. Create the controller

```ts
// apps/api/src/modules/report/report.controller.ts
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthGuard } from "../auth/guards/auth.guard";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { apiContract } from "@workspace/shared";
import { apiPath } from "@workspace/shared";
import { ReportService } from "./report.service";

@Controller(apiPath("/report"))
@UseGuards(AuthGuard, PermissionGuard)
export class ReportController {
  public constructor(private readonly service: ReportService) {}

  @Get()
  @RequirePermission("LIST", "REPORT")
  public list(@Query(new ZodValidationPipe(apiContract.report.list.input)) query: Parameters<typeof apiContract.report.list.input.parse>[0]) {
    return this.service.list(query);
  }
}
```

### 4c. Create the module

```ts
// apps/api/src/modules/report/report.module.ts
import { Module } from "@nestjs/common";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";

@Module({
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
```

### 4d. Register in `app.module.ts`

```ts
// apps/api/src/app.module.ts
import { ReportModule } from "./modules/report/report.module";

@Module({
  imports: [
    // ... existing modules ...
    ReportModule,
  ],
})
export class AppModule {}
```

---

## Step 5: Add Permissions (`packages/shared`)

```ts
// In the permissions seed file (prisma/seed/permissions.ts)
{ action: "LIST",   resource: "REPORT" },
{ action: "READ",   resource: "REPORT" },
{ action: "CREATE", resource: "REPORT" },
{ action: "UPDATE", resource: "REPORT" },
{ action: "DELETE", resource: "REPORT" },
```

---

## Step 6: Define the Client Endpoint (`packages/client`)

```ts
// packages/client/src/lib/api/endpoints.ts — add to apiRouter
import {
  ReportListResponseSchema,
  // ... other report schemas
} from "@workspace/shared";

report: {
  list: defineQuery(apiContract.report.list, {
    response: ReportListResponseSchema,
    queryKey: (input) => ["report", "list", input],
  }),
  detail: defineQuery(apiContract.report.detail, {
    response: ReportDetailResponseSchema,
    queryKey: (input) => ["report", "detail", input.id],
  }),
  create: defineMutation(apiContract.report.create, {
    response: ReportEntrySchema,
    queryKey: (input) => ["report", "list"],
  }),
},
```

---

## Step 7: Build the Admin Page (`apps/admin`)

### 7a. Server page (SSR fetch)

```tsx
// apps/admin/app/(panel)/reports/page.tsx
import { createServerCaller } from "@workspace/client/lib/api/server-api";
import { ReportsView } from "./reports-view";

export default async function ReportsPage(): Promise<React.JSX.Element> {
  const server = createServerCaller();
  const initialData = await server.report.list.query({ page: 1, pageSize: 20 });
  return <ReportsView initialData={initialData} />;
}
```

### 7b. Client view (smart component)

```tsx
// apps/admin/app/(panel)/reports/reports-view.tsx
"use client";

import { useAuth } from "@workspace/client/lib/auth";
import type { Envelope, ReportListResponse } from "@workspace/shared";

interface ReportsViewProps {
  readonly initialData: Envelope<ReportListResponse>;
}

export function ReportsView({ initialData }: ReportsViewProps): React.JSX.Element {
  const { api } = useAuth();
  const listQuery = api.report.list.useQuery({ page: 1, pageSize: 20 }, { initialData });
  // ... render logic
}
```

---

## Step 8: Add to Sidebar Navigation

```ts
// apps/admin/lib/navigation/sidebar.ts
{
  label: "Reports",
  href: "/reports",
  icon: FileText,  // from lucide-react
  permission: { action: "LIST", resource: "REPORT" },
}
```

---

## Step 9: Add to the Menu (`apps/admin/lib/menu.ts`)

```ts
// apps/admin/lib/menu.ts — add to the menu tree
{
  label: "Reports",
  href: "/reports",
  icon: "file-text",
  permission: "REPORT:LIST",
}
```

---

## Step 10: Run the Full Reset Cycle

```bash
# 1. Reset database
cd apps/api
npx prisma migrate reset

# 2. Apply migrations
npx prisma migrate dev

# 3. Apply RLS policies
npx ts-node scripts/apply-rls.ts

# 4. Seed data (includes new permissions)
npx prisma db seed

# 5. Regenerate Prisma client
npx prisma generate

# 6. Start dev servers
pnpm run dev
```

---

## Step 11: Update Documentation

Add a section to `docs/architecture.md`:

```markdown
### Reports Module

- **Schema:** `packages/shared/src/schemas/domain/report.ts`
- **Contract:** `apiContract.report.*` in `packages/shared/src/contracts/index.ts`
- **Route:** `apiRoutes.report.*` in `packages/shared/src/api-routes.ts`
- **Controller:** `apps/api/src/modules/report/report.controller.ts`
- **Service:** `apps/api/src/modules/report/report.service.ts`
- **Admin Page:** `apps/admin/app/(panel)/reports/`
- **Permissions:** `REPORT:LIST`, `REPORT:READ`, `REPORT:CREATE`, `REPORT:UPDATE`, `REPORT:DELETE`
```

---

## Checklist

- [ ] Schema defined in `packages/shared/src/schemas/domain/`
- [ ] Route added to `apiRoutes` in `packages/shared/src/api-routes.ts`
- [ ] Contract added to `apiContract` in `packages/shared/src/contracts/index.ts`
- [ ] Endpoint added to `apiRouter` in `packages/client/src/lib/api/endpoints.ts`
- [ ] NestJS module created (controller + service + module)
- [ ] Module registered in `app.module.ts`
- [ ] Permissions added to seed file
- [ ] Admin page created with SSR + client view
- [ ] Added to sidebar navigation
- [ ] Documentation updated
- [ ] Full reset cycle completed (migrate → RLS → seed → generate)
