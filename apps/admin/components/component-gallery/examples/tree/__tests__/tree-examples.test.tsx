// @vitest-environment jsdom
import { TREE_EXAMPLES } from "@/components/component-gallery/examples/tree";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Tree", TREE_EXAMPLES);
