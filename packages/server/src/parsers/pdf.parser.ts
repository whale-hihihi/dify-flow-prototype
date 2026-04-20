import { IFileParser } from './parser-interface';
import fs from 'fs';
import util from 'util';

const readFile = util.promisify(fs.readFile);

export class PdfParser implements IFileParser {
  async parse(filePath: string): Promise<string> {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  }
}
