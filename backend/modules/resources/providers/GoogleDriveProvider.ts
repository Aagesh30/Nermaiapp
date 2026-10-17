import { Readable } from 'stream';
import { IResourceProvider, StreamOptions, StreamResult } from './IResourceProvider';
import { IResource } from '../types';
import axios from 'axios';
import { google } from 'googleapis';
import { decrypt } from '../../../core/utils/encryption';
import { AppError } from '../../../core/errors/AppError';
import { env } from '../../../config/env';

export class GoogleDriveProvider implements IResourceProvider {
  async getStream(resource: IResource, options?: StreamOptions): Promise<StreamResult> {
    let fileId = decrypt(resource.storagePath);
    if (!fileId) {
      throw new AppError('Invalid Google Drive File ID', 400);
    }
    if (fileId.startsWith('http') || fileId.includes('/')) {
      const match = fileId.match(/[-\w]{25,}/);
      if (match) fileId = match[0];
    }

    // ── Method 1: Google Drive v3 API (Primary: Zero virus scan limits, supports files > 25MB & Range requests) ──
    const clientEmail = env.DRIVE_CLIENT_EMAIL || env.GCP_CLIENT_EMAIL;
    const rawKey = env.DRIVE_PRIVATE_KEY || env.GCP_PRIVATE_KEY;

    if (clientEmail && rawKey) {
      try {
        const auth = new google.auth.JWT({
          email: clientEmail,
          key: rawKey.replace(/\\n/g, '\n'),
          scopes: [
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/drive'
          ]
        });

        const drive = google.drive({ version: 'v3', auth });

        const streamHeaders: Record<string, string> = {};
        if (options?.start !== undefined && options?.end !== undefined) {
          streamHeaders['Range'] = `bytes=${options.start}-${options.end}`;
        }

        const driveRes = await drive.files.get(
          { fileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'stream', headers: streamHeaders }
        );

        const upstreamContentRange = driveRes.headers['content-range'] as string | undefined;
        const rawContentLength = driveRes.headers['content-length'];
        const parsedSize = rawContentLength ? parseInt(String(rawContentLength), 10) : resource.fileSize;

        return {
          stream: driveRes.data,
          size: parsedSize || resource.fileSize,
          mimeType: resource.mimeType || 'application/pdf',
          etag: `"${resource.checksum}"`,
          contentRange: upstreamContentRange,
        };
      } catch (driveApiErr: any) {
        console.warn('[GoogleDriveProvider] Drive API stream failed, attempting direct HTTP stream:', driveApiErr?.message);
      }
    }

    // ── Method 2: HTTP Stream with 2024+ Confirmation Bypass Fallback ──
    try {
      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };

      if (options?.start !== undefined && options?.end !== undefined) {
        headers['Range'] = `bytes=${options.start}-${options.end}`;
      }

      const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

      let response = await axios({
        url: initialUrl,
        method: 'GET',
        responseType: 'stream',
        headers,
        maxRedirects: 5,
        timeout: 120000,
        validateStatus: (status) => status < 400,
      });

      const contentType = String(response.headers['content-type'] || '').toLowerCase();

      // If Google returns an HTML warning page for files > 25MB, parse modern confirmation form
      if (contentType.includes('text/html')) {
        const html = await new Promise<string>((resolve, reject) => {
          let data = '';
          response.data.on('data', (chunk: any) => data += chunk.toString('utf8'));
          response.data.on('end', () => resolve(data));
          response.data.on('error', reject);
        });

        const cookies = response.headers['set-cookie']
          ? (response.headers['set-cookie'] as string[]).map(c => c.split(';')[0]).join('; ')
          : '';

        // Form action or anchor tag
        const formActionMatch = html.match(/<form[^>]*action="([^"]+)"/i);
        const linkMatch = html.match(/<a[^>]*href="([^"]+)"[^>]*id="uc-download-link"/i) ||
                          html.match(/href="([^"]*confirm=[^"]*)"/i);

        // Extract hidden form inputs (confirm token, uuid, id, export)
        const inputMatches = [...html.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)];
        const formParams = new URLSearchParams();
        for (const m of inputMatches) {
          formParams.append(m[1], m[2]);
        }

        let confirmUrl = '';
        if (formActionMatch && formActionMatch[1]) {
          confirmUrl = formActionMatch[1];
          if (!confirmUrl.startsWith('http')) {
            confirmUrl = `https://drive.usercontent.google.com${confirmUrl.startsWith('/') ? '' : '/'}${confirmUrl}`;
          }
        } else if (linkMatch && linkMatch[1]) {
          confirmUrl = linkMatch[1].replace(/&amp;/g, '&');
          if (!confirmUrl.startsWith('http')) {
            confirmUrl = `https://drive.usercontent.google.com${confirmUrl.startsWith('/') ? '' : '/'}${confirmUrl}`;
          }
        } else {
          const tokenMatch = html.match(/confirm=([0-9a-zA-Z_-]+)/);
          if (tokenMatch && tokenMatch[1]) {
            confirmUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${tokenMatch[1]}`;
          }
        }

        if (confirmUrl) {
          if (cookies) headers['Cookie'] = cookies;
          const finalTarget = formParams.toString()
            ? `${confirmUrl}${confirmUrl.includes('?') ? '&' : '?'}${formParams.toString()}`
            : confirmUrl;

          response = await axios({
            url: finalTarget,
            method: 'GET',
            responseType: 'stream',
            headers,
            maxRedirects: 5,
            timeout: 120000,
            validateStatus: (status) => status < 400,
          });
        }
      }

      const upstreamContentRange = response.headers['content-range'] as string | undefined;
      const rawContentLength = response.headers['content-length'];
      const parsedSize = rawContentLength ? parseInt(String(rawContentLength), 10) : resource.fileSize;

      return {
        stream: response.data,
        size: parsedSize || resource.fileSize,
        mimeType: resource.mimeType || 'application/pdf',
        etag: `"${resource.checksum}"`,
        contentRange: upstreamContentRange,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch Google Drive file: ${error.message}`, 502);
    }
  }
}
