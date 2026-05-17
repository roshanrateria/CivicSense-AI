import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads directory
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    
    // Unique filename to avoid collisions
    const uniqueName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const filepath = path.join(uploadDir, uniqueName);
    
    await writeFile(filepath, buffer);
    
    // Return the public URL
    const imageUrl = `/uploads/${uniqueName}`;

    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
