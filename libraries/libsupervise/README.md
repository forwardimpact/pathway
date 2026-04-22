# libsupervise

Process supervision for Forward Impact services.

## Getting Started

```js
import { createSupervisionTree, LongrunProcess, OneshotProcess } from '@forwardimpact/libsupervise';

const tree = createSupervisionTree('/var/log/fit');
```
