import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('web', 'dist', { recursive: true });
await writeFile('dist/.nojekyll', '');
console.log('Built dist/: static course and simulations only. Live API requires npm start on localhost.');
