# libconfig

Configuration management and environment resolution.

## Getting Started

```js
import { createConfig, createServiceConfig } from '@forwardimpact/libconfig';

const config = await createServiceConfig('myservice', { port: 3000 });
```
