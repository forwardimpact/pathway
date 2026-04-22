# libstorage

Storage abstraction layer supporting local filesystem, S3, and Supabase
backends.

## Getting Started

```js
import { createStorage } from '@forwardimpact/libstorage';

const storage = createStorage('mybucket');
await storage.put('key.json', { hello: 'world' });
const data = await storage.get('key.json');
```
