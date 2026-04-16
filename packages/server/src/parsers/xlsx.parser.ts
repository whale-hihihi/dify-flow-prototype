import { IFileParser } from './parser-interface';
import XLSX from 'xlsx';

export class XlsxParser implements IFileParser {
  async parse(filePath: string): Promise<string> {
    const workbook = XLSX.readFile(filePath);
    const lines: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      lines.push(`=== ${sheetName} ===`);
      lines.push(csv);
    }

    return lines.join('\n');
  }
}
