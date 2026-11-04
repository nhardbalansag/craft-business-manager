import { calculateBusinessReport } from './businessReports';
self.onmessage = event => {
  try {
    const { receipts, entries, workspace, from, to } = event.data;
    self.postMessage({ result: calculateBusinessReport(receipts, entries, workspace, from, to) });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'The report could not be calculated.' }); }
};
