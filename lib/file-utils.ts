export interface FileData {
  mimeType: string;
  data: string; // base64 string
  name: string;
}

export function getMimeType(file: File): string {
  if (file.type) {
    return file.type;
  }
  // Fallback based on extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    pdf: 'application/pdf',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    csv: 'text/csv',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1] || result;
      
      // Logging: Verify base64 extraction
      if (!base64 || base64.length === 0) {
        console.error(`[Client] Failed to extract base64 from file: ${file.name} (${file.size} bytes)`);
        reject(new Error(`Failed to extract base64 data from ${file.name}`));
        return;
      }
      
      console.log(`[Client] Successfully extracted base64 from ${file.name}: ${base64.length} chars, ${(base64.length * 3 / 4 / 1024).toFixed(2)}KB estimated`);
      resolve(base64);
    };
    reader.onerror = (error) => {
      console.error(`[Client] FileReader error for ${file.name}:`, error);
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}

export async function processFile(file: File): Promise<FileData> {
  const mimeType = getMimeType(file);
  const data = await fileToBase64(file);
  return {
    mimeType,
    data,
    name: file.name,
  };
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 20 * 1024 * 1024; // 20MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 20MB' };
  }

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
    'application/vnd.ms-powerpoint', // PPT
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/msword', // DOC
    'text/csv', // CSV
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
  ];

  const mimeType = getMimeType(file);
  if (!allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: 'Only PDF, PPTX, DOCX, CSV, and image files (PNG, JPEG, GIF, WebP) are supported',
    };
  }

  return { valid: true };
}
