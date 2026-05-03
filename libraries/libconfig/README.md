# libconfig

<!-- BEGIN:description — Do not edit. Generated from package.json. -->

Environment-aware application settings — services and CLIs load configuration
without custom plumbing.

<!-- END:description -->

## Getting Started

```js
import { createConfig, createServiceConfig } from '@forwardimpact/libconfig';

const config = await createServiceConfig('myservice', { port: 3000 });
```
