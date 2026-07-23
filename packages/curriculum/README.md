# @hanziquest/curriculum

Task 1.1 defines the read-only curriculum domain and runtime boundary for tracks, worlds, units,
lessons, activities, character concepts, words, sentences, and stories.

Key rules:

- Character concepts use stable UUIDs rather than a simplified glyph as identity.
- Every learner-facing text stores simplified and traditional forms.
- Curriculum and minimum app versions use semantic versions.
- Prerequisites are explicit ID references; graph and reference integrity belong to Task 1.2.
- Schemas are strict and infer their TypeScript types directly from Zod.
- The included fixture is synthetic and contains no child or household data.

```ts
import { CurriculumPackageSchema, isCurriculumCompatible } from '@hanziquest/curriculum';

const curriculum = CurriculumPackageSchema.parse(untrustedJson);
const supported = isCurriculumCompatible(appVersion, curriculum.minimumAppVersion);
```
