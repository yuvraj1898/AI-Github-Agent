const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const { embedAndStore } = require('./embedder');

const TEMP_DIR = './cloned_repo';

const allowedExtensions = ['.js', '.ts', '.py', '.jsx', '.tsx', '.json', '.md', '.txt'];

async function walk(dir) {
  const files = await fs.readdir(dir);
  let all = [];
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      all = all.concat(await walk(full));
    } else if (allowedExtensions.some(ext => full.endsWith(ext))) {
      all.push(full);
    }
  }
  return all;
}

async function processRepo(repoUrl) {
  const cloneDir = TEMP_DIR;

  // Clean existing cloned folder
  await fs.remove(cloneDir);

  // Clone new repo
  await simpleGit().clone(repoUrl, cloneDir);

  const files = await walk(cloneDir);
  const texts = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf-8');
    texts.push({
      text: content,
      metadata: { filePath, repo: repoUrl }
    });
  }

  await embedAndStore(texts);

  // Optional: Clean up cloned repo after processing
  await fs.remove(cloneDir);

  return { totalFiles: files.length };
}

module.exports = { processRepo };
