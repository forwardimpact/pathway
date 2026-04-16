# Dataset Blocks

The terrain DSL may include `dataset` and `output` blocks that use external
tools (Synthea, SDV, Faker). Unavailable tools are automatically skipped with an
info log — the pipeline continues and writes all other generated files normally.

Tool availability:

| Tool    | Requirement         | Always available? |
| ------- | ------------------- | ----------------- |
| Faker   | Built-in (pure JS)  | Yes               |
| Synthea | Java + JAR file     | No                |
| SDV     | Python + sdv module | No                |

**Note:** The `--only` flag gates which render types execute (html, pathway,
raw, markdown). It does **not** affect dataset generation — datasets run when
present in the DSL but skip gracefully if the tool is unavailable.
