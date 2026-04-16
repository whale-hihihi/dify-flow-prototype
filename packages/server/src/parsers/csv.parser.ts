import { IFileParser } from './parser-interface';
import fs from 'fs';
import { parse } from 'csv-parse';

export class CsvParser implements IFileParser {
  async parse(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const rows: string[] = [];
      fs.createReadStream(filePath)
        .pipe(parse({ relax_column_count: true }))
        .on('data', (row: string[]) => {
          rows.push(row.join(' | '));
        })
        .on('end', () => {
          resolve(rows.join('\n'));
        })
        .on('error', reject);
    });
  }
}
