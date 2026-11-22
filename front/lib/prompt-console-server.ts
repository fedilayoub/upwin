import 'server-only';

import { cache } from 'react';
import { getBackendApiClient } from '@/lib/api/server';

export const getCurrentPromptConsole = cache(async () => {
  const api = await getBackendApiClient();
  const [console, revisions] = await Promise.all([
    api.getPromptConsole('profileAnalyzer'),
    api.listPromptRevisions('profileAnalyzer'),
  ]);
  return { console, revisions };
});
