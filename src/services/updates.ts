export const VERSION = '1.0.0';
export const REPOSITORY = 'https://github.com/kotyasmol/radical-lab';
export const RELEASES = `${REPOSITORY}/releases`;
export function isNewerVersion(candidate: string, current = VERSION): boolean {
  const pattern = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;
  const a = pattern.exec(candidate),
    b = pattern.exec(current);
  if (!a || !b) throw new Error('Invalid release version');
  for (let i = 1; i <= 3; i++) {
    if (+a[i] !== +b[i]) return +a[i] > +b[i];
  }
  return false;
}
export async function checkForUpdate(
  fetcher: typeof fetch = fetch,
): Promise<{ version: string; newer: boolean }> {
  const response = await fetcher(
    'https://api.github.com/repos/kotyasmol/radical-lab/releases/latest',
    {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!response.ok) throw new Error('Update check failed');
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== 'object' ||
    !('tag_name' in data) ||
    typeof data.tag_name !== 'string'
  )
    throw new Error('Invalid release');
  return { version: data.tag_name, newer: isNewerVersion(data.tag_name) };
}
