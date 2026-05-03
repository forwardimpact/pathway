# libformat

<!-- BEGIN:description — Do not edit. Generated from package.json. -->

Render markdown to ANSI or HTML — formatted output in any surface without losing
structure.

<!-- END:description -->

## Getting Started

```js
import { createHtmlFormatter, createTerminalFormatter } from '@forwardimpact/libformat';

const fmt = createTerminalFormatter();
console.log(fmt.format('**hello**'));
```
