import { readFile, writeFile } from 'node:fs/promises';
const packages = ['decimal.js', 'nerdamer', 'react', 'react-dom'];
let output =
  '# Third-party notices\n\nRuntime libraries bundled in the portable distribution. Development dependencies are recorded in package-lock.json and are not shipped as runtime services.\n';
for (const name of packages) {
  const folder = new URL(`../node_modules/${name}/`, import.meta.url);
  const pkg = JSON.parse(await readFile(new URL('package.json', folder), 'utf8'));
  let license;
  for (const file of ['LICENSE', 'LICENCE.md', 'LICENSE.md', 'LICENSE.txt', 'license.txt']) {
    try {
      license = await readFile(new URL(file, folder), 'utf8');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!license) throw new Error(`Missing license for ${name}`);
  output += `\n## ${name} ${pkg.version}\n\n${pkg.repository?.url ?? ''}\n\n${license.replaceAll('\r\n', '\n').trimEnd()}\n`;
}
await writeFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), output.trimEnd() + '\n');
