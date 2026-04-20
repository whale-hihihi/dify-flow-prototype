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
