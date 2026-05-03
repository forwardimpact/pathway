# librepl

<!-- BEGIN:description — Do not edit. Generated from package.json. -->

Agent-friendly interactive REPL — exploratory interfaces that humans and agents
navigate the same way.

<!-- END:description -->

## Getting Started

```js
import { Repl } from '@forwardimpact/librepl';

const repl = new Repl({
  prompt: '> ',
  onLine: async (line, state, output) => { output.end(line); },
});
await repl.start();
```
