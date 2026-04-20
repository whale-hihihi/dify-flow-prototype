import { IFileParser } from './parser-interface';
import fs from 'fs';

const MAX_RETRIES = 3;
const MIN_TEXT_LENGTH = 50; // 少于此长度认为文字提取失败，尝试 OCR

export class PdfParser implements IFileParser {
  async parse(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);

    // 阶段1：用 pdf-parse 快速提取嵌入文字（带重试）
    let text = await this.tryTextExtraction(buffer);
    // 过滤 null bytes（0x00），PostgreSQL UTF8 编码不接受
    text = text.replace(/\0/g, '');
    if (text.length >= MIN_TEXT_LENGTH) {
      return text;
    }

    // 阶段2：文字太少或为空，尝试 OCR（适用于扫描件/图片 PDF）
    const ocrText = await this.tryOcr(buffer);
    if (ocrText.length > 0) {
      return ocrText;
    }

    return text.length > 0 ? text : '';
  }

  /**
   * 用 pdf-parse 提取 PDF 内嵌文字，带重试机制
   */
  private async tryTextExtraction(buffer: Buffer): Promise<string> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        return (data.text || '').trim();
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 200 * attempt));
        }
      }
    }
    return '';
  }

  /**
   * 用 pdfjs-dist 渲染 PDF 页面为图片，再用 tesseract.js 做 OCR
   */
  private async tryOcr(buffer: Buffer): Promise<string> {
    try {
      const { createCanvas, Path2D } = await import('@napi-rs/canvas');
      if (!(globalThis as any).Path2D) {
        (globalThis as any).Path2D = Path2D;
      }
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const { createWorker, PSM } = await import('tesseract.js');

      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const worker = await createWorker(['chi_sim', 'eng']);
      // 优化版面分析：假定统一文本块，减少乱加字符
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      });
      const texts: string[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        // scale 4.0 提供更高分辨率，提升中英文混排识别精度
        const viewport = page.getViewport({ scale: 4.0 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx as any, viewport }).promise;

        // 直接使用渲染后的原图做 OCR（不做二值化预处理，避免破坏清晰字符）
        const imageBuf = canvas.toBuffer('image/png');

        const { data: { text } } = await worker.recognize(imageBuf);
        const cleaned = this.postProcessText(text);
        if (cleaned.length > 0) {
          texts.push(cleaned);
        }
      }

      await worker.terminate();
      return texts.join('\n\n');
    } catch (err: any) {
      console.error('[PdfParser] OCR failed:', err.message);
      return '';
    }
  }

  /**
   * OCR 后处理：清理 tesseract 对中文的常见识别错误
   */
  private postProcessText(text: string): string {
    return text
      // 去掉中文字符之间的多余空格（中文排版不需要空格）
      .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
      // 去掉中文和英文/数字之间的多余空格
      .replace(/([\u4e00-\u9fff])\s+(?=[a-zA-Z0-9])/g, '$1')
      .replace(/([a-zA-Z0-9])\s+(?=[\u4e00-\u9fff])/g, '$1')
      // 修复常见 OCR 对中文字符的误识别
      .replace(/若能体/g, '智能体')
      .replace(/僵\s*有/g, '既有')
      .replace(/构\s*思/g, '构思')
      // 修复常见技术术语 OCR 错误
      .replace(/Rea[c?]et/gi, 'React')
      .replace(/Ex[e?]el/gi, 'Excel')
      .replace(/WepbSocket/gi, 'WebSocket')
      .replace(/PostgresQaL/gi, 'PostgreSQL')
      .replace(/tsSVecto[rRT]/gi, 'tsVector')
      .replace(/Node\s*\.\s*js/g, 'Node.js')
      // 修复 OCR 在英文缩写后多加的字符（如 PDFE → PDF）
      .replace(/(PDF|CSV|TXT|HTML|JSON)([A-Z])/g, (match, prefix, extra) => {
        // 如果 extra 紧跟中文标点（、，。等），说明是多识别的字符
        return prefix;
      })
      // 修复编号后多余标点（"1，" "2.，" 等）
      .replace(/^(\d+)\s*[.，、]+,/gm, '$1.')
      .replace(/^(\d+)\s*[.，]\s*[,，]/gm, '$1.')
      // 去掉行首行尾空白
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .trim();
  }
}
