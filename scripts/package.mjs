import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const source = await readFile(new URL('../src/services/updates.ts', import.meta.url), 'utf8');
if (!source.includes(`VERSION = '${pkg.version}'`))
  throw new Error('Runtime and package versions differ');
if (
  process.env.GITHUB_REF?.startsWith('refs/tags/') &&
  process.env.GITHUB_REF !== `refs/tags/v${pkg.version}`
)
  throw new Error('Tag and package versions differ');
const root = new URL('../dist/', import.meta.url);
const notices = await readFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
const built = await readFile(new URL('index.html', root), 'utf8');
await writeFile(
  new URL('index.html', root),
  built + '\n<!-- Third-party licenses\n' + notices.replaceAll('-->', '-- >') + '\n-->\n',
);
await copyFile(new URL('index.html', root), new URL('radical-lab.html', root));
await writeFile(new URL('THIRD_PARTY_NOTICES.txt', root), notices);
const html = await readFile(new URL('radical-lab.html', root));
await writeFile(
  new URL('SHA256SUMS.txt', root),
  `${createHash('sha256').update(html).digest('hex')}  radical-lab.html\n`,
);
await writeFile(new URL('version.json', root), JSON.stringify({ version: pkg.version }) + '\n');
console.log(`Portable release: ${html.length.toLocaleString('en-US')} bytes; SHA-256 generated.`);
