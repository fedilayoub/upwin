import { sendExtensionRequest } from '@/features/extension/client';
import {
  createRuntimeStatusRequest,
  isRuntimeStatus,
  type RuntimeStatus,
} from '@/features/extension/protocol';

export const extensionService = {
  getRuntimeStatus(): Promise<RuntimeStatus> {
    return sendExtensionRequest(createRuntimeStatusRequest(), isRuntimeStatus);
  },
};
