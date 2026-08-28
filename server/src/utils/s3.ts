import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import dbHelper, { saveDatabase } from '../db/index.js';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = resolve(__dirname, '../../../data/uploads');

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface StorageConfig {
  storage_type: 'local' | 'r2';
  r2_account_id?: string;
  r2_access_key_id?: string;
  r2_secret_access_key?: string;
  r2_bucket_name?: string;
  r2_public_domain?: string;
}

export function getStorageSettings(): StorageConfig {
  const rows = dbHelper.all('SELECT key, value FROM storage_settings');
  const config: StorageConfig = {
    storage_type: 'local',
    r2_account_id: '',
    r2_access_key_id: '',
    r2_secret_access_key: '',
    r2_bucket_name: '',
    r2_public_domain: '',
  };

  for (const row of rows) {
    if (row.key in config) {
      (config as any)[row.key] = row.value;
    }
  }

  return config;
}

export function saveStorageSettings(settings: Partial<StorageConfig>): void {
  for (const [k, v] of Object.entries(settings)) {
    if (v !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO storage_settings (key, value) VALUES (?, ?)', [k, String(v)]);
    }
  }
  saveDatabase();
}

export function getR2Client(customConfig?: Partial<StorageConfig>): S3Client | null {
  const cfg = { ...getStorageSettings(), ...(customConfig || {}) };
  if (!cfg.r2_account_id || !cfg.r2_access_key_id || !cfg.r2_secret_access_key) {
    return null;
  }

  const endpoint = `https://${cfg.r2_account_id.trim()}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: cfg.r2_access_key_id.trim(),
      secretAccessKey: cfg.r2_secret_access_key.trim(),
    },
  });
}

export async function testR2Connection(customConfig?: Partial<StorageConfig>): Promise<{ success: boolean; message: string }> {
  const cfg = { ...getStorageSettings(), ...(customConfig || {}) };
  if (!cfg.r2_account_id || !cfg.r2_access_key_id || !cfg.r2_secret_access_key || !cfg.r2_bucket_name) {
    return { success: false, message: '请完整填写 Account ID、Access Key、Secret Key 与存储桶名称' };
  }

  const client = getR2Client(cfg);
  if (!client) {
    return { success: false, message: '初始化 R2 客户端失败' };
  }

  try {
    const cmd = new ListObjectsV2Command({
      Bucket: cfg.r2_bucket_name.trim(),
      MaxKeys: 1,
    });
    await client.send(cmd);
    return { success: true, message: 'Cloudflare R2 存储桶连通性测试成功！' };
  } catch (err: any) {
    return { success: false, message: `连接 R2 失败: ${err.message || String(err)}` };
  }
}

export async function uploadFileBuffer(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<{
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
  isImage: boolean;
  storage: 'local' | 'r2';
}> {
  const config = getStorageSettings();
  const safeBaseName = basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_') || 'file.bin';
  const uniqueKey = `${Date.now()}-${safeBaseName}`;
  const isImage = (mimeType || '').startsWith('image/');

  if (config.storage_type === 'r2' && config.r2_bucket_name) {
    const client = getR2Client(config);
    if (client) {
      const uploadCmd = new PutObjectCommand({
        Bucket: config.r2_bucket_name.trim(),
        Key: uniqueKey,
        Body: buffer,
        ContentType: mimeType || 'application/octet-stream',
      });
      await client.send(uploadCmd);

      let publicUrl = '';
      if (config.r2_public_domain && config.r2_public_domain.trim()) {
        const domain = config.r2_public_domain.trim().replace(/\/+$/, '');
        publicUrl = `${domain}/${uniqueKey}`;
      } else {
        publicUrl = `/api/notes/raw/${uniqueKey}`;
      }

      return {
        name: originalFilename,
        path: uniqueKey,
        url: publicUrl,
        size: buffer.length,
        mimeType: mimeType || 'application/octet-stream',
        isImage,
        storage: 'r2',
      };
    }
  }

  // 本地存储兜底
  const localFilePath = resolve(UPLOAD_DIR, uniqueKey);
  writeFileSync(localFilePath, buffer);

  return {
    name: originalFilename,
    path: uniqueKey,
    url: `/api/notes/raw/${uniqueKey}`,
    size: buffer.length,
    mimeType: mimeType || 'application/octet-stream',
    isImage,
    storage: 'local',
  };
}

export async function deleteStorageFile(fileKey: string, storage: 'local' | 'r2' = 'local'): Promise<void> {
  if (!fileKey) return;
  const safeKey = basename(fileKey);

  if (storage === 'r2') {
    const config = getStorageSettings();
    const client = getR2Client(config);
    if (client && config.r2_bucket_name) {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.r2_bucket_name.trim(),
            Key: safeKey,
          })
        );
      } catch {}
    }
  } else {
    const localFilePath = resolve(UPLOAD_DIR, safeKey);
    if (existsSync(localFilePath)) {
      try {
        unlinkSync(localFilePath);
      } catch {}
    }
  }
}
