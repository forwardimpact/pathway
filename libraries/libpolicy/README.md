# libpolicy

<!-- BEGIN:description — Do not edit. Generated from package.json. -->

Access-control policy evaluation — scoped context access without per-service
authorization logic.

<!-- END:description -->

## Getting Started

```js
import { createPolicy } from '@forwardimpact/libpolicy';

const policy = createPolicy();
await policy.load();
const allowed = await policy.evaluate({ actor: 'user:1', resources: ['doc:2'] });
```
