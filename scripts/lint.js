import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';

const rootDir = process.cwd();

function collectFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, results);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

async function runLint() {
  const allFiles = collectFiles(rootDir);
  const tsFiles = allFiles.filter(
    (file) =>
      file.endsWith('.ts') ||
      file.endsWith('.tsx') ||
      file.endsWith('.d.ts') ||
      path.basename(file).startsWith('tsconfig')
  );

  if (tsFiles.length > 0) {
    console.error('TypeScript files are disallowed:', tsFiles);
    process.exit(1);
  }

  // Verify server.js syntax
  if (fs.existsSync(path.join(rootDir, 'server.js'))) {
    execSync('node --check server.js', { stdio: 'inherit' });
  }

  // Verify client bundle compiles & resolves all imports cleanly via esbuild
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'src/main.jsx')],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'esm',
    jsx: 'automatic',
    loader: {
      '.js': 'jsx',
      '.jsx': 'jsx',
      '.css': 'empty',
      '.svg': 'dataurl',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
    },
  });

  console.log('JavaScript lint & import validation passed.');
}

runLint().catch((err) => {
  console.error(err);
  process.exit(1);
});
