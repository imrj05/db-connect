export function formatBytes(bytes: number): string {
    if (bytes >= 1_048_576) return `${Number((bytes / 1_048_576).toFixed(1))} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} bytes`;
}
