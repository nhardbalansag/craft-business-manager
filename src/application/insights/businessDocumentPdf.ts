import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { businessDay, validateBusinessDocument, type BusinessDocument } from '../../domain/businessInsights';
import { businessDocumentBlocks } from './businessDocuments';

/** The PDF engine and embedded fonts are loaded only when a PDF is requested. No data leaves the browser. */
export async function businessDocumentPdf(document: BusinessDocument): Promise<Blob> {
  validateBusinessDocument(document);
  if (document.kind !== 'investor-proposal') throw new Error('Use Print / Save PDF for this document type.');
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  const content: Content[] = [
    { text: document.profile.name.toUpperCase(), fontSize: 11, bold: true, color: '#763923', margin: [0, 0, 0, 8] },
    { text: document.title, fontSize: 24, bold: true, margin: [0, 0, 0, 8] },
    { text: [document.profile.contact, document.profile.website].filter(Boolean).join(' · '), color: '#756153', margin: [0, 0, 0, 14] },
    ...businessDocumentBlocks(document).map((block): Content => {
      if (block.kind === 'page-break') return { text: '', pageBreak: 'before' };
      if (block.kind === 'text') return { text: block.text, bold: !!block.heading, fontSize: block.heading ? 13 : 11,
        color: block.heading ? '#763923' : '#35251e', margin: block.heading ? [0, 12, 0, 6] : [0, 0, 0, 8] };
      if (block.kind === 'photo') return { image: block.data, fit: [70, 70], margin: [0, 5, 0, 5] };
      return { table: { headerRows: 1, dontBreakRows: true, keepWithHeaderRows: 1, widths: block.headers.map(() => '*'),
        body: [block.headers.map(text => ({ text, bold: true, fillColor: '#F2E9DF', color: '#763923' })), ...block.rows] },
        fontSize: 9, margin: [0, 5, 0, 12],
        layout: { hLineWidth: () => .4, vLineWidth: () => 0, hLineColor: () => '#DFD5C9', paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 6, paddingBottom: () => 6 } };
    }),
  ];
  const definition: TDocumentDefinitions = {
    pageSize: 'A4', pageMargins: [40, 38, 40, 45], defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.15, color: '#35251e' },
    info: { title: document.title, author: document.profile.name, subject: 'Proposed investment terms and estimated earnings. Not guaranteed payments.' },
    content,
    footer: (current, pages) => ({ text: `${document.profile.name} · ${businessDay(document.generatedAt)} (SGT) · Estimated figures · ${current} / ${pages}`,
      fontSize: 7, color: '#756153', alignment: 'center', margin: [40, 12, 40, 0] }),
  };
  return pdfMake.createPdf(definition).getBlob();
}
