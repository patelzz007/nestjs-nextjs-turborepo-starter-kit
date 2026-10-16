// @vitest-environment jsdom
import { AVATAR_EXAMPLES } from "@/components/component-gallery/examples/avatar";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Avatar", AVATAR_EXAMPLES);
