# libstorage

<!-- BEGIN:description — Do not edit. Generated from package.json. -->

Pluggable file storage — local, S3, or Supabase behind a single interface.

<!-- END:description -->

## Getting Started

```js
import { createStorage } from '@forwardimpact/libstorage';

const storage = createStorage('mybucket');
await storage.put('key.json', { hello: 'world' });
const data = await storage.get('key.json');
```
