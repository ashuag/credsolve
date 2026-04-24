import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const filePath = '/home/saurabha/.gemini/antigravity/brain/a120e3c8-ac7d-4ea3-b3a1-91f9befc4dc2/loan_infographic_1777041042659.png';
  try {
    const imageBuffer = fs.readFileSync(filePath);
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new NextResponse('Image not found', { status: 404 });
  }
}
