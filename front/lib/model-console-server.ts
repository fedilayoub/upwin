import 'server-only';

import { cache } from 'react';
import { getBackendApiClient } from '@/lib/api/server';

export const getCurrentModelConsole = cache(async () => {
  const api = await getBackendApiClient();
  const [console, catalog] = await Promise.all([
    api.getModelConsole(),
    api.getModelCatalog(),
  ]);
  return { console, catalog };
});
