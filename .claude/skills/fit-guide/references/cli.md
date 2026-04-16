# CLI Reference

### Conversational Agent

```sh
npx fit-guide                              # Interactive REPL — multi-turn conversations
npx fit-guide --help                       # Auto-generated flag and /command listing
npx fit-guide --version                    # Print package version
npx fit-guide init                       # First-run bootstrap (see Initialization)
npx fit-guide --data <path>                # Override the framework data directory
npx fit-guide --data=<path>                # Equivalent inline form
npx fit-guide --streaming                  # Use the streaming gRPC endpoint (default: unary)
echo "Tell me about X" | npx fit-guide     # Piped single prompt
```

The CLI is built on `@forwardimpact/librepl`, so every flag has a matching
`/command` form inside the interactive REPL: `/help`, `/clear`, `/exit`,
`/version`, `/data <path>`, `/streaming`.

**Transport.** Uses unary RPC by default; `--streaming` is opt-in (HTTP/2 proxy
compatibility).

### Supporting CLI Tools

```sh
npx fit-search "query text"              # Vector similarity search
npx fit-query <s> <p> <o>                # Graph triple pattern queries
npx fit-subjects <type>                  # List graph subjects by type
npx fit-rc status                        # Service health
```
