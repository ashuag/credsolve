export type LoanDocumentFieldOverlay = {
  key: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
};

export type LoanDocumentFieldOverlayMap = {
  pageHeight?: number;
  fields: LoanDocumentFieldOverlay[];
};
