# libformat

Markdown formatting and text processing utilities for HTML and terminal output.

## Getting Started

```js
import { createHtmlFormatter, createTerminalFormatter } from '@forwardimpact/libformat';

const fmt = createTerminalFormatter();
console.log(fmt.format('**hello**'));
```
