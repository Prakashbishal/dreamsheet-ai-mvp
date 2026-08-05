import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const MAX_EMAIL_PDF_BYTES = 3 * 1024 * 1024;
const MAX_DOWNLOAD_PDF_BYTES = 20 * 1024 * 1024;

export interface DreamSheetPdfOptions {
  captureScale?: number;
  imageQuality?: number;
  marginMm?: number;
}

export class DreamSheetPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DreamSheetPdfError';
  }
}

const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

function findPageBreak(context: CanvasRenderingContext2D, start: number, idealEnd: number, width: number): number {
  const minimum = start + Math.floor((idealEnd - start) * 0.72);
  const searchStep = Math.max(1, Math.floor(width / 800));
  for (let y = idealEnd; y >= minimum; y -= searchStep) {
    const pixels = context.getImageData(0, y, width, 1).data;
    let ink = 0;
    for (let x = 0; x < pixels.length; x += 16) {
      if (pixels[x] < 242 || pixels[x + 1] < 242 || pixels[x + 2] < 242) ink += 1;
    }
    if (ink / Math.max(1, pixels.length / 16) < 0.012) return y;
  }
  return idealEnd;
}

export async function generateDreamSheetPdf(element: HTMLElement, options: DreamSheetPdfOptions = {}): Promise<Blob> {
  if (!element) throw new DreamSheetPdfError('The printable DREAMsheet is unavailable.');
  await document.fonts?.ready;
  await nextPaint();

  const width = element.scrollWidth;
  const height = element.scrollHeight;
  if (width <= 0 || height <= 0) throw new DreamSheetPdfError('The printable DREAMsheet has no content.');

  const scale = options.captureScale ?? 1.5;
  const quality = options.imageQuality ?? 0.86;
  const margin = options.marginMm ?? 10;
  let canvas: HTMLCanvasElement | null = null;

  try {
    canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      logging: false,
      scale,
      useCORS: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
    });
    if (!canvas.width || !canvas.height) throw new DreamSheetPdfError('The DREAMsheet capture was empty.');

    const pdf = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;
    const pagePixelHeight = Math.max(1, Math.floor(canvas.width * contentHeight / contentWidth));
    const sourceContext = canvas.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) throw new DreamSheetPdfError('The DREAMsheet capture could not be read.');

    let sourceY = 0;
    let pageIndex = 0;
    while (sourceY < canvas.height) {
      const idealEnd = Math.min(canvas.height, sourceY + pagePixelHeight);
      const sourceEnd = idealEnd < canvas.height
        ? Math.max(sourceY + 1, findPageBreak(sourceContext, sourceY, idealEnd, canvas.width))
        : canvas.height;
      const sliceHeight = sourceEnd - sourceY;
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const pageContext = pageCanvas.getContext('2d');
      if (!pageContext) throw new DreamSheetPdfError('A PDF page could not be created.');
      pageContext.fillStyle = '#ffffff';
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      if (pageIndex > 0) pdf.addPage('a4', 'portrait');
      const renderedHeight = sliceHeight * contentWidth / canvas.width;
      pdf.addImage(pageCanvas.toDataURL('image/jpeg', quality), 'JPEG', margin, margin, contentWidth, renderedHeight, undefined, 'FAST');
      pageCanvas.width = 0;
      pageCanvas.height = 0;
      sourceY = sourceEnd;
      pageIndex += 1;
    }

    const generated = pdf.output('blob');
    const blob = generated.type === 'application/pdf' ? generated : new Blob([generated], { type: 'application/pdf' });
    if (!blob.size) throw new DreamSheetPdfError('The generated PDF was empty.');
    if (blob.size > MAX_DOWNLOAD_PDF_BYTES) throw new DreamSheetPdfError('The generated PDF is unexpectedly large.');
    const signature = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
    if (signature !== '%PDF-') throw new DreamSheetPdfError('The generated file is not a valid PDF.');
    return blob;
  } catch (error) {
    if (error instanceof DreamSheetPdfError) throw error;
    throw new DreamSheetPdfError('The DREAMsheet PDF could not be created.');
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

export function createDreamSheetFilename(clientName: string, date = new Date()): string {
  const safeName = clientName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'Coachee';
  return `DREAMsheet-Strategic-Plan-${safeName}-${date.toISOString().slice(0, 10)}.pdf`;
}
