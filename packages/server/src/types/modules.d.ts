declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: any): Promise<PDFData>;
  export default pdfParse;
}

declare module 'mammoth' {
  function extractRawText(options: { path: string }): Promise<{ value: string; messages: any[] }>;
}

declare module 'csv-parse';

declare module '@napi-rs/canvas' {
  export function createCanvas(width: number, height: number): any;
  export const Path2D: any;
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export function getDocument(options: { data: Uint8Array }): any;
}
