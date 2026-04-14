---
name: libs-llm-and-agents
description: >
  Use when making LLM completion or embedding requests, managing conversation
  memory within token budgets, loading and rendering prompt templates,
  orchestrating multi-turn agents with tool calling, dispatching tool calls
  from an LLM response, or generating tool schemas from protobuf definitions.
---

# LLM and Agents

## When to Use

- Making LLM chat completion or embedding requests
- Managing conversation memory within token budgets
- Loading and rendering prompt templates from files
- Building conversational agents with tool calling and multi-turn state
- Dispatching tool calls or generating tool schemas from protobuf

## Libraries

| Library   | Capabilities                                                   | Key Exports                                                                               |
| --------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| libllm    | Send completions and embeddings to OpenAI-compatible endpoints | `LlmApi`, `createLlmApi`, `normalizeVector`, `getBudget`                                  |
| libmemory | Token-budgeted context window construction                     | `MemoryWindow`, `getModelBudget`                                                          |
| libprompt | Load and render .prompt.md templates with Mustache             | `PromptLoader`, `createPromptLoader`                                                      |
| libagent  | Multi-turn conversation orchestration with tools               | `AgentMind`, `AgentHands`                                                                 |
| libtool   | Dispatch tool calls, generate tool schemas from protobuf       | `ToolProcessor`, `mapFieldToSchema`, `generateSchemaFromProtobuf`, `buildToolDescription` |

## Decision Guide

- **libllm alone vs libagent** — Use `LlmApi` directly for single-shot
  completions (embeddings, classification, one-off generation). Use `AgentMind`
  for multi-turn conversations with tool calling and memory management.
- **libprompt vs inline strings** — Always use `PromptLoader` for system prompts
  (supports Mustache variable substitution, file-based management). Use inline
  strings only for dynamic user messages constructed at runtime.
- **libmemory** — Used internally by `AgentMind`. Access `MemoryWindow` directly
  only when building custom memory strategies or non-standard context window
  layouts.
- **libtool vs libagent** — `ToolProcessor` for binding a protobuf tool service
  into an LLM-callable tool schema and dispatching individual tool calls.
  `AgentMind` for running the full conversation loop that invokes tools via
  `AgentHands`.

## Composition Recipes

### Recipe 1: Single-shot LLM call

```javascript
import { LlmApi } from "@forwardimpact/libllm";

const api = new LlmApi(config, logger);
const response = await api.completion(
  [{ role: "user", content: "Summarize this document" }],
  { model: "gpt-4", maxTokens: 1000 },
);
```

### Recipe 2: Multi-turn agent with tools

```javascript
import { AgentMind } from "@forwardimpact/libagent";
import { createPromptLoader } from "@forwardimpact/libprompt";

const promptLoader = createPromptLoader("./prompts");
const agent = new AgentMind(memoryClient, llmClient, toolClient);

const response = await agent.process({
  resourceId: conversationId,
  content: "What is the weather?",
});

// Streaming
for await (const chunk of agent.stream(request)) {
  process.stdout.write(chunk.content);
}
```

### Recipe 3: Custom memory window

```javascript
import { MemoryWindow } from "@forwardimpact/libmemory";

const window = new MemoryWindow(resourceId, resourceIndex, memoryIndex);
const { messages, tools } = await window.build("gpt-4", 1000);
```

### Recipe 4: Generate tool schema from protobuf

```javascript
import { ToolProcessor, generateSchemaFromProtobuf } from "@forwardimpact/libtool";

const schema = generateSchemaFromProtobuf(protoDefinition);
const processor = new ToolProcessor(toolClient, logger);
const result = await processor.dispatch(toolCall);
```

## DI Wiring

### libllm

```javascript
// LlmApi — accepts config and logger
const api = new LlmApi(config, logger);
const response = await api.completion(messages, options);
const embeddings = await api.embed(texts);
```

### libmemory

```javascript
// MemoryWindow — accepts resourceId, resourceIndex, memoryIndex
const window = new MemoryWindow(resourceId, resourceIndex, memoryIndex);
const { messages, tools } = await window.build("gpt-4", 1000);

// getModelBudget — pure function
import { getModelBudget } from "@forwardimpact/libmemory";
const budget = getModelBudget(modelName);
```

### libprompt

```javascript
// PromptLoader — accepts directory path
const loader = new PromptLoader("./prompts");
const rendered = loader.render("system", { agentName: "Assistant" });

// createPromptLoader — convenience factory
const loader = createPromptLoader("./prompts");
```

### libagent

```javascript
// AgentMind — accepts memoryClient, llmClient, toolClient
const agent = new AgentMind(memoryClient, llmClient, toolClient);
const response = await agent.process({ resourceId, content });
```

### libtool

```javascript
// ToolProcessor — accepts toolClient and logger
const processor = new ToolProcessor(toolClient, logger);
const result = await processor.dispatch(toolCall);

// generateSchemaFromProtobuf — pure function
const schema = generateSchemaFromProtobuf(protoDefinition);

// buildToolDescription — pure function
const description = buildToolDescription(toolName, schema);
```
