/** Shared screen-space layout helpers for readable transient UI. */
export function temporaryMessageLayout(viewportWidth: number, viewportHeight: number) {
  const safeMargin = Math.min(48, Math.max(16, Math.floor(viewportWidth * 0.05)));
  const width = Math.max(160, viewportWidth - safeMargin * 2 - 24);
  return {
    width,
    x: viewportWidth / 2,
    // Keep the message above the two-line controls legend and interaction prompt.
    y: Math.max(100, viewportHeight - 175),
  };
}

export function temporaryMessageDuration(text: string, requestedDuration: number): number {
  const estimatedLines = text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 48)), 0);
  return Math.max(requestedDuration, 1000 + estimatedLines * 350);
}

export function clueModalHeight(content: string, viewportHeight: number, panelWidth: number): number {
  const charsPerLine = Math.max(18, Math.floor((panelWidth - 56) / 9));
  const lineCount = content.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return Math.min(420, viewportHeight - 32, Math.max(220, 150 + lineCount * 23));
}
