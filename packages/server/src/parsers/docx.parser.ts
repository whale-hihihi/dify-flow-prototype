import { IFileParser } from './parser-interface';
import mammoth from 'mammoth';

export class DocxParser implements IFileParser {
  async parse(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }
}
