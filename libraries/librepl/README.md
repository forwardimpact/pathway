# librepl

Interactive REPL with command handling, state persistence, and terminal formatting.

## Getting Started

```js
import { Repl } from '@forwardimpact/librepl';

const repl = new Repl({
  prompt: '> ',
  onLine: async (line, state, output) => { output.end(line); },
});
await repl.start();
```
