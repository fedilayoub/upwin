export function serializePromptData(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/&/gu, '\\u0026')
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e');
}
