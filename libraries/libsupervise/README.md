# libsupervise

<!-- BEGIN:description — Do not edit. Generated from package.json. -->

Process supervision driven by JSON daemon manifests — services stay running and
recoverable without manual intervention.

<!-- END:description -->

## Getting Started

```js
import { createSupervisionTree, LongrunProcess, OneshotProcess } from '@forwardimpact/libsupervise';

const tree = createSupervisionTree('/var/log/fit');
```
