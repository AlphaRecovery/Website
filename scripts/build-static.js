const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'build');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      copyFile(from, to);
    }
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.html') {
    copyFile(path.join(root, entry.name), path.join(outDir, entry.name));
  }
}
copyDir(path.join(root, 'assets'), path.join(outDir, 'assets'));
copyDir(path.join(root, 'content'), path.join(outDir, 'content'));
if (fs.existsSync(path.join(root, '_headers'))) {
  copyFile(path.join(root, '_headers'), path.join(outDir, '_headers'));
}

console.log('Static site copied to build/');
