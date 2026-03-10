declare module 'mammoth/mammoth.browser' {
  interface MammothInput {
    arrayBuffer: ArrayBuffer;
  }

  interface MammothResult {
    value: string;
  }

  interface MammothBrowserApi {
    convertToHtml(input: MammothInput): Promise<MammothResult>;
  }

  const mammoth: MammothBrowserApi;
  export default mammoth;
}
