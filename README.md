# design: the source of the Monorithm Experience Language

This repository holds the source of the Monorithm Experience Language. The source is the authority of the language. The site and the packages read the language from here.

| Repository | Contents |
| --- | --- |
| `monorithm/design` (this one, `@monorithm/design`) | The source: tokens, icons, moments, motion, haptics, sound, and the contracts of the components. Its schemas, the compiler, and the intermediate form of each language version |
| `monorithm/ux` | The site of the language, `ux.monorithm.dev` |
| `monorithm/react` (`@monorithm/react`), `monorithm/react-native` (`@monorithm/react-native`), and one repository for each next stack | The package of each stack. Each package pins one version of the intermediate form of this repository |

## The planned layout

| Folder | Contents |
| --- | --- |
| `source/` | The values of the language. Tokens in the DTCG format, the icons, the moments, the motion, the haptic patterns, and the sounds |
| `contracts/` | One contract for each component. A contract tells the anatomy, the states, the keyboard model, and the moments, with no code of a stack |
| `schemas/` | One JSON Schema for each kind of data in `source/` and `contracts/` |
| `compiler/` | The compiler. It examines the source against the schemas and writes the intermediate form |
| `ir/<version>/` | The intermediate form of each released language version |

The layout grows in the order of the plan. At this time it has the list of the components of version 1 and the contracts of the first 14 components. It also has the tokens that these components use. Read the build order in `contracts/v1-components.md`.

## Build and check

| Command | Result |
| --- | --- |
| `yarn build` | The compiler writes `ir/<version>/` from `source/` and `contracts/` |
| `yarn check` | The drift check: `ir/<version>/` must match the source |
| `yarn test` | The tests of the compiler |
| `yarn typecheck` | The type check of the compiler |

The version of the language is the version of the package `@monorithm/design`. A released `ir/<version>/` does not change. A test compares each of its files with the checksum in its manifest.

## The tools

Node 26.13 or a newer version is necessary (`.node-version`). The repository uses Yarn Berry: run `yarn install --immutable`.

## The text

All text is in ASD-STE100 Simplified Technical English.

## License

Copyright 2026 Harnicode. The Apache License, Version 2.0 applies to this repository (`LICENSE`). Harnicode is the owner of the name Monorithm, the Monorithm icon, and the related branding (`NOTICE`).
