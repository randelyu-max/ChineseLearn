# @hanziquest/content-validator

Pure TypeScript curriculum validation for Task 1.2. It performs no network, database, AI, or UI work.

Checks include strict Zod parsing, duplicate IDs/content, complete references, target presence,
unknown-character limits, sentence length, simplified/traditional consistency, answer validity,
story coverage, and prerequisite graph cycles.

Every issue has a stable machine code, source, object ID when available, field path, and readable
message. Run the synthetic example with:

```sh
pnpm content:validate
```

An external JSON file can be checked with the package command:

```sh
pnpm --filter @hanziquest/content-validator validate:content -- ./path/to/package.json
```
