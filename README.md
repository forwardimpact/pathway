# Forward Impact

Applications that help teams grow and cultivate world-class engineers in the age
of AI.

## Vision

Engineering excellence requires both human growth and AI augmentation. Our apps
provide the foundation: defining skills, behaviours, and career paths that work
equally well for human engineers and AI coding agents—all from the same coherent
model.

## Apps

| Package                                | Purpose                                        |
| -------------------------------------- | ---------------------------------------------- |
| [@forwardimpact/schema](apps/schema)   | Schema definitions and data loading            |
| [@forwardimpact/model](apps/model)     | Derivation engine for roles and agent profiles |
| [@forwardimpact/pathway](apps/pathway) | Web app and CLI for career progression         |

## Quick Start

```sh
git clone https://github.com/forwardimpact/pathway.git
cd pathway
npm install
npm start
```

Open http://localhost:3000 to explore.

## Documentation

- [Overview](docs/index.md) — Vision and high-level concepts
- [Schema](docs/schema/index.md) — Data model and validation
- [Model](docs/model/index.md) — Derivation logic
- [Pathway](docs/pathway/index.md) — Web app and CLI

## Development

```sh
npm run check      # Format, lint, test
npm run validate   # Validate YAML data
npm run test:e2e   # End-to-end tests
```

## License

Apache-2.0
