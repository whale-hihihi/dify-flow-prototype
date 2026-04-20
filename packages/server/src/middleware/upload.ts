import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { ALLOWED_MIME_TYPES } from '../config/constants';

// Multer 1.4.x 对非 ASCII 文件名使用 latin1 编码，中文会乱码
// 需要手动从 latin1 重新解码为 utf-8
function decodeFileName(originalname: string): string {
  try {
    return Buffer.from(originalname, 'latin1').toString('utf-8');
  } catch {
    return originalname;
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // 修复中文文件名编码
    file.originalname = decodeFileName(file.originalname);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});
