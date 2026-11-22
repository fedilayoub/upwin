import type {
  CapabilityModelConsole,
  ModelProbeResponse,
} from '@/lib/api/types';

export interface ModelMutationActionResult {
  status: 'success' | 'error';
  message: string;
  capability?: CapabilityModelConsole;
}

export interface ModelProbeActionResult {
  status: 'success' | 'error';
  message: string;
  probe?: ModelProbeResponse;
}
