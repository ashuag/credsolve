const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function parseMajor(version) {
  const match = /^v?(\d+)/.exec(version);
  return match ? Number(match[1]) : 0;
}

function compareVersionsDesc(left, right) {
  const leftParts = left.replace(/^v/, '').split('.').map(Number);
  const rightParts = right.replace(/^v/, '').split('.').map(Number);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue !== rightValue) {
      return rightValue - leftValue;
    }
  }

  return 0;
}

function findNode20Binary() {
  const versionsDir = path.join(os.homedir(), '.nvm', 'versions', 'node');

  if (!fs.existsSync(versionsDir)) {
    return null;
  }

  const candidates = fs.readdirSync(versionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v20\./.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareVersionsDesc);

  for (const version of candidates) {
    const binaryPath = path.join(versionsDir, version, 'bin', 'node');

    if (fs.existsSync(binaryPath)) {
      return binaryPath;
    }
  }

  return null;
}

const prismaCliPath = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
const currentNodeMajor = parseMajor(process.version);
const preferredNode = currentNodeMajor >= 20 ? process.execPath : findNode20Binary();

if (!preferredNode) {
  console.error('Prisma CLI requires Node 20+ in this environment. Switch to Node 20 and rerun the command.');
  process.exit(1);
}

const result = spawnSync(preferredNode, [prismaCliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
