import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function runCommand(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

/** Best-effort: stitch JPEG liveness frames into a short webm using ffmpeg when available. */
export async function encodeLivenessFramesToWebm(frames: Buffer[]): Promise<Buffer | null> {
  const usable = frames.filter((frame) => frame.length > 0);
  if (usable.length < 2) return null;

  const ffmpegOk = await runCommand('ffmpeg', ['-version']);
  if (!ffmpegOk) return null;

  const dir = await mkdtemp(join(tmpdir(), 'mc-liveness-video-'));
  try {
    for (let i = 0; i < usable.length; i += 1) {
      const name = `frame${String(i).padStart(3, '0')}.jpg`;
      await writeFile(join(dir, name), usable[i]);
    }

    const outPath = join(dir, 'liveness.webm');
    const encoded =
      (await runCommand('ffmpeg', [
        '-y',
        '-framerate',
        '4',
        '-i',
        join(dir, 'frame%03d.jpg'),
        '-c:v',
        'libvpx-vp9',
        '-b:v',
        '450k',
        '-an',
        outPath,
      ])) ||
      (await runCommand('ffmpeg', [
        '-y',
        '-framerate',
        '4',
        '-i',
        join(dir, 'frame%03d.jpg'),
        '-c:v',
        'libvpx',
        '-b:v',
        '450k',
        '-an',
        outPath,
      ]));

    if (!encoded) return null;
    return readFile(outPath);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
