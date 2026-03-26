// Type stub for xlsx/SheetJS — package is loaded at runtime
// biome-ignore lint/suspicious/noExplicitAny: type stub
declare module "xlsx" {
  const utils: any;
  function readFile(path: string, opts?: any): any;
  function read(data: any, opts?: any): any;
  function writeFile(wb: any, filename: string, opts?: any): void;
  function write(wb: any, opts?: any): any;
  const SSF: any;
  const Stream: any;
}
