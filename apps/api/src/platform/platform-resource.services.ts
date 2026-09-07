import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { z } from "zod/v4";

import {
	JsonObjectSchema,
	PlatformResourceAuditInputSchema,
	PlatformResourceIdempotencyInputSchema,
	type JsonObject,
	type PlatformResourceAuditInput,
	type PlatformResourceIdempotencyInput,
} from "@workspace/shared";

import { PrismaService } from "../prisma/prisma.service";
import { parsePrismaNullableJson } from "../common/utils/prisma-json";

@Injectable()
export class PlatformResourceAuditService {
	private readonly logger: Logger = new Logger(PlatformResourceAuditService.name);

	public constructor(private readonly prisma: PrismaService) {}

	public async log(input: PlatformResourceAuditInput, tx?: Prisma.TransactionClient): Promise<void> {
		const parsed = PlatformResourceAuditInputSchema.parse(input);
		const client = tx ?? this.prisma;
		try {
			await client.platformResourceAuditLog.create({
				data: {
					resourceType: parsed.resourceType,
					resourceId: parsed.resourceId,
					action: parsed.action,
					actorUserId: parsed.actorUserId,
					changes: parsePrismaNullableJson(parsed.changes),
				},
			});
		} catch (error) {
			this.logger.error(error instanceof Error ? error.message : "audit write failed");
		}
	}
}

@Injectable()
export class PlatformResourceIdempotencyService {
	public constructor(private readonly prisma: PrismaService) {}

	public async findReplay(scope: string, idempotencyKey: string, requestHash: string): Promise<JsonObject | null> {
		const existing = await this.prisma.platformResourceIdempotencyRecord.findUnique({
			where: { scope_idempotencyKey: { scope, idempotencyKey } },
		});
		if (existing === null) {
			return null;
		}
		if (existing.requestHash !== requestHash) {
			return null;
		}
		return JsonObjectSchema.parse(existing.responseBody);
	}

	public async store(input: PlatformResourceIdempotencyInput, tx?: Prisma.TransactionClient): Promise<void> {
		const parsed = PlatformResourceIdempotencyInputSchema.parse(input);
		const client = tx ?? this.prisma;
		await client.platformResourceIdempotencyRecord.create({
			data: {
				scope: parsed.scope,
				idempotencyKey: parsed.idempotencyKey,
				requestHash: parsed.requestHash,
				responseBody: parsed.responseBody,
			},
		});
	}
}

@Injectable()
export class PlatformResourceMutationService {
	public constructor(
		private readonly auditService: PlatformResourceAuditService,
		private readonly idempotencyService: PlatformResourceIdempotencyService,
		private readonly prisma: PrismaService,
	) {}

	public async runMutation<T>(options: {
		readonly scope: string;
		readonly idempotencyKey: string | null;
		readonly requestHash: string;
		readonly resourceType: string;
		readonly resourceId: string;
		readonly action: string;
		readonly actorUserId: string | null;
		readonly changes: JsonObject | null;
		readonly responseSchema: z.ZodType<T>;
		readonly execute: (tx: Prisma.TransactionClient) => Promise<T>;
		readonly toResponse: (result: T) => JsonObject;
	}): Promise<T> {
		if (options.idempotencyKey !== null) {
			const replay = await this.idempotencyService.findReplay(options.scope, options.idempotencyKey, options.requestHash);
			if (replay !== null) {
				return options.responseSchema.parse(replay);
			}
		}

		const result = await this.prisma.$transaction(async (tx) => {
			const value = await options.execute(tx);
			await this.auditService.log(
				{
					resourceType: options.resourceType,
					resourceId: options.resourceId,
					action: options.action,
					actorUserId: options.actorUserId,
					changes: options.changes,
				},
				tx,
			);
			if (options.idempotencyKey !== null) {
				await this.idempotencyService.store(
					{
						scope: options.scope,
						idempotencyKey: options.idempotencyKey,
						requestHash: options.requestHash,
						responseBody: options.toResponse(value),
					},
					tx,
				);
			}
			return value;
		});

		return result;
	}
}
