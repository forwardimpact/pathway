# libpolicy

Policy engine foundation for access control.

## Getting Started

```js
import { createPolicy } from '@forwardimpact/libpolicy';

const policy = createPolicy();
await policy.load();
const allowed = await policy.evaluate({ actor: 'user:1', resources: ['doc:2'] });
```
