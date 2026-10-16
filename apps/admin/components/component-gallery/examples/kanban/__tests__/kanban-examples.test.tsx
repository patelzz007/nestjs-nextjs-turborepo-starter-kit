// @vitest-environment jsdom
import { KANBAN_EXAMPLES } from "@/components/component-gallery/examples/kanban";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Kanban", KANBAN_EXAMPLES);
