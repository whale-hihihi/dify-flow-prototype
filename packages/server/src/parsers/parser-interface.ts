export interface IFileParser {
  parse(filePath: string): Promise<string>;
}
