import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Default configuration: no page cache. Shop pages are rendered on every request (see `dynamic = 'force-dynamic'`),
// so new products, prices and stock show immediately. To add cached pages later, configure the KV incremental cache:
// https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig();
