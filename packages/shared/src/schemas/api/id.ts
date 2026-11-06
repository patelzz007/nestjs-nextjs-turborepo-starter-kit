import { z } from "zod";

/** An entity's id: a plain string at runtime, but `Id<"User">` and `Id<"Tenant">` are different types, so swapping them stops compiling. */
export type Id<TEntity extends string> = string & z.core.$brand<TEntity>;

/**
 * The schema that produces `Id<TEntity>`. Contract schemas use it, so an id is branded where it enters the
 * API. The uuid step does the checking and keeps the OpenAPI format; the second step only names the type.
 */
export function idSchema<TEntity extends string>(entity: TEntity): z.ZodPipe<z.ZodUUID, z.ZodCustom<Id<TEntity>>> {
	return z.uuid({ error: `must be a ${entity} id` }).pipe(z.custom<Id<TEntity>>(() => true));
}

export const UserIdSchema = idSchema("User");
export const LocationIdSchema = idSchema("Location");

export type UserId = z.output<typeof UserIdSchema>;
export type LocationId = z.output<typeof LocationIdSchema>;
