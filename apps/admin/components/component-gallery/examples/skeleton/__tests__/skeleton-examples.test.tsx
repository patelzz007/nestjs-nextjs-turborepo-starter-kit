// @vitest-environment jsdom
import { SKELETON_EXAMPLES } from "@/components/component-gallery/examples/skeleton";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Skeleton", SKELETON_EXAMPLES);
