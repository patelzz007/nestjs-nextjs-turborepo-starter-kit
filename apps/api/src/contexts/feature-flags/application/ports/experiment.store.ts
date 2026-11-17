import type { CreateExperimentInput, Experiment, ExperimentResults, UpdateExperimentInput } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Written } from "./flag-admin.store";

export type ExperimentWriteOutcome =
	| { readonly kind: "WRITTEN"; readonly written: Written<Experiment> }
	| { readonly kind: "NOT_FOUND" }
	| { readonly kind: "WRONG_STATE"; readonly status: Experiment["status"] }
	/** Another experiment already runs on the config. */
	| { readonly kind: "CONFIG_BUSY" };

/** Experiments, under `feature_flags.read` / `feature_flags.write`. */
export interface ExperimentStore {
	list(actor: ActorContext): Promise<readonly Experiment[]>;
	find(actor: ActorContext, experimentId: string): Promise<Experiment | null>;
	results(actor: ActorContext, experimentId: string): Promise<ExperimentResults>;
	/** Null: a live experiment already has that key. */
	create(actor: ActorContext, input: CreateExperimentInput, salt: string): Promise<Written<Experiment> | null>;
	/** A draft only. */
	update(actor: ActorContext, experimentId: string, input: UpdateExperimentInput): Promise<ExperimentWriteOutcome>;
	/** DRAFT → RUNNING (one running per config). */
	start(actor: ActorContext, experimentId: string, reason: string, at: number): Promise<ExperimentWriteOutcome>;
	/** RUNNING → STOPPED, with its conclusion. */
	stop(actor: ActorContext, experimentId: string, reason: string, conclusion: string, at: number): Promise<ExperimentWriteOutcome>;
}

export const EXPERIMENT_STORE = Symbol("EXPERIMENT_STORE");
