export function createJsonDownloadFilename(prefix: string, date = new Date()): string {
  const datePart = date.toISOString().slice(0, 10);
  return `${prefix}-${datePart}.json`;
}

export function downloadJsonFile(filename: string, json: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('File downloads are unavailable in this environment.');
  }
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
