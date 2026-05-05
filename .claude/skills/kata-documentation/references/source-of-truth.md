# Source of Truth

When writing or reviewing documentation, verify claims against the canonical
source. Never trust documentation alone — read the code.

| Documentation topic  | Verify against                                   |
| -------------------- | ------------------------------------------------ |
| Entity definitions   | `data/pathway/` (capabilities, behaviours, etc.) |
| Library derivations  | `libraries/{lib}/src/`                           |
| Product validation   | `products/{product}/src/`                        |
| Product CLIs         | `products/{product}/bin/fit-{product}.js`        |
| Library CLIs         | `libraries/{lib}/bin/fit-{lib}.js`               |
| Templates            | `products/{product}/templates/`                  |
| JSON Schema          | `products/{product}/schema/json/`                |
| RDF/SHACL Schema     | `products/{product}/schema/rdf/`                 |
| LLM / SEO outputs    | `websites/llms.txt`, `websites/robots.txt`       |
| Kata Agent Team      | `KATA.md`                                        |
