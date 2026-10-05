/**
 * Pull plain text out of an uploaded kit sheet. PDFs use pdf.js; photos/scans use
 * Tesseract OCR in the browser (it downloads its English model on first use).
 * Both libraries are loaded on demand to keep the initial bundle small.
 */
export async function extractText(file: File, onProgress?: (msg: string) => void): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    onProgress?.('Reading PDF…')
    return extractPdf(file)
  }
  if (file.type.startsWith('image/')) {
    return extractImage(file, onProgress)
  }
  onProgress?.('Reading text…')
  return file.text()
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent()
    // Group text runs into lines by their y position so table rows stay together.
    const rows = new Map<number, { x: number; str: string }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 3) * 3
      const row = rows.get(y) ?? []
      row.push({ x: item.transform[4], str: item.str })
      rows.set(y, row)
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => row.sort((a, b) => a.x - b.x).map((r) => r.str.trim()).join(' '))
    pages.push(lines.join('\n'))
  }
  return pages.join('\n')
}

async function extractImage(file: File, onProgress?: (msg: string) => void): Promise<string> {
  onProgress?.('Loading text recognition…')
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(`Reading photo… ${Math.round(m.progress * 100)}%`)
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return data.text
  } finally {
    await worker.terminate()
  }
}
