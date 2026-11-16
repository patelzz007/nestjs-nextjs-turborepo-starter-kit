// The Gantt's gesture math rules: shared with the native kit (@workspace/ui-kit-logic `gantt`), re-exported for
// the web kit's modules and consumers.

export {
	axisMinutesAt,
	clampToNeighbours,
	computeBarGestureRange,
	computeCreateGestureRange,
	computeKeyboardStep,
	maxResizeStartMs,
	minResizeEndMs,
	movedEnd,
	overlapsNeighbours,
	resolveKeyboardIntent,
	resolveOverlapPolicy,
	resolveSnapMinutes,
	snapAxisMinutes,
	type GanttAxisGeometry,
	type GanttBarGestureInput,
	type GanttCreateGestureInput,
	type GanttGestureKind,
	type GanttGestureRange,
	type GanttKeyboardIntent,
	type GanttKeyboardKeys,
	type GanttKeyboardStepInput,
	type GanttNeighbourSpan,
	type GanttStepDirectionSign,
} from "@workspace/ui-kit-logic";
