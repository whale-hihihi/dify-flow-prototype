import { IFileParser } from './parser-interface';
import { PdfParser } from './pdf.parser';
import { DocxParser } from './docx.parser';
import { XlsxParser } from './xlsx.parser';
import { TxtParser } from './txt.parser';
import { MdParser } from './md.parser';
import { CsvParser } from './csv.parser';

export function getParser(fileType: string): IFileParser {
  switch (fileType) {
    case 'pdf':
      return new PdfParser();
    case 'docx':
      return new DocxParser();
    case 'xlsx':
      return new XlsxParser();
    case 'txt':
      return new TxtParser();
    case 'md':
      return new MdParser();
    case 'csv':
      return new CsvParser();
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
