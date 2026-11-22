import {
  parseExtractedCompleteness,
  parseExtractedProfile,
  type RawExtractedProfile,
} from './parser';
import { parseProfileSnapshot, type ProfileCaptureResult } from './schema';

export function mapExtractedProfile(
  raw: RawExtractedProfile,
  capturedAt: string,
): ProfileCaptureResult {
  return parseProfileSnapshot({
    source: 'upwork',
    capturedAt,
    completeness: parseExtractedCompleteness(raw.completeness),
    profile: parseExtractedProfile(raw),
  });
}
