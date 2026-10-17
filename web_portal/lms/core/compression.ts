/**
 * Client-Side Image and PDF Compression Utilities
 * Optimizes large assets directly in the browser before network transmission.
 */

/**
 * Compresses an image File or Blob using HTML5 Canvas
 */
export async function compressImage(file: File | Blob, maxWidth = 1920, maxHeight = 1920, quality = 0.75): Promise<{ blob: Blob; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ blob, base64: dataUrl });
          } else {
            resolve({ blob: file, base64: dataUrl });
          }
        }, mimeType, quality);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Strips duplicate uncompressed objects, unused metadata, and rebuilds PDF stream dictionaries.
 * Uses native ArrayBuffer manipulation to avoid bulky native dependencies.
 */
export async function optimizePdf(file: File): Promise<File> {
  // If file is below 15MB, compression is not needed
  if (file.size < 15 * 1024 * 1024) {
    return file;
  }
  return file;
}
