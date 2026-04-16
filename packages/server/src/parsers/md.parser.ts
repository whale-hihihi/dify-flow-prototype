import { IFileParser } from './parser-interface';
import fs from 'fs';
import util from 'util';

const readFile = util.promisify(fs.readFile);

export class MdParser implements IFileParser {
  async parse(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    return buffer.toString('utf-8');
  }
}
