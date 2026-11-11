export function asJson(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}
