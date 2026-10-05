import { z } from "zod";

/** Empty BullMQ scheduler payload — use for tick/sweep jobs with no data. */
export const EmptyQueuePayloadSchema = z.object({}).strict();

export type EmptyQueuePayload = z.output<typeof EmptyQueuePayloadSchema>;
