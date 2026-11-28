declare module 'citeproc' {
  export interface CiteprocSys {
    retrieveLocale: (lang: string) => string;
    retrieveItem: (id: string) => Record<string, unknown>;
  }
  export class Engine {
    constructor(sys: CiteprocSys, style: string, lang?: string, forceLang?: boolean);
    updateItems(ids: string[]): void;
    makeBibliography(): [{ bibliography_errors?: unknown[] }, string[]] | false;
    processCitationCluster(
      citation: { citationItems: Array<{ id: string }>; properties: { noteIndex: number } },
      citationsPre: unknown[],
      citationsPost: unknown[]
    ): [unknown, Array<[number, string, string]>];
  }
  const CSL: { Engine: typeof Engine };
  export default CSL;
}
