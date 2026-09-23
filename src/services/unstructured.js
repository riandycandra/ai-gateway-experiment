import dotenv from 'dotenv';

dotenv.config();

const UNSTRUCTURED_API_URL = process.env.UNSTRUCTURED_API_URL || 'https://api.unstructuredapp.io/general/v0/general';
const UNSTRUCTURED_API_KEY = process.env.UNSTRUCTURED_API_KEY;

/**
 * Mengirim file PDF (Buffer) ke Unstructured.io Cloud untuk diekstrak dan di-chunk berdasarkan judul/bab/pasal.
 * 
 * @param {Buffer} fileBuffer - Buffer konten PDF
 * @param {string} fileName - Nama file PDF
 * @param {object} options - Opsi chunking tambahan
 * @returns {Promise<Array<{ text: string, heading: string, pageNumber: number, type: string }>>}
 */
export async function partitionAndChunkPdf(fileBuffer, fileName = 'document.pdf', options = {}) {
  if (!UNSTRUCTURED_API_KEY) {
    throw new Error('UNSTRUCTURED_API_KEY is not defined in environment variables.');
  }

  const formData = new FormData();
  const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
  formData.append('files', fileBlob, fileName);

  // Parameter cerdas untuk PDF Regulasi / JDIH
  formData.append('strategy', options.strategy || 'auto');
  formData.append('chunking_strategy', options.chunkingStrategy || 'by_title');
  formData.append('max_characters', String(options.maxCharacters || 1200));
  formData.append('combine_text_under_n_chars', String(options.combineTextUnderNChars || 200));
  formData.append('new_after_n_chars', String(options.newAfterNChars || 800));
  formData.append('split_pdf_page', 'true');

  console.log(`🌐 Sending "${fileName}" (${(fileBuffer.length / 1024).toFixed(1)} KB) to Unstructured.io Cloud...`);

  const response = await fetch(UNSTRUCTURED_API_URL, {
    method: 'POST',
    headers: {
      'unstructured-api-key': UNSTRUCTURED_API_KEY,
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Unstructured.io API error (${response.status} ${response.statusText}): ${errorBody}`);
  }

  const elements = await response.json();
  console.log(`🧩 Unstructured.io returned ${elements.length} elements/chunks.`);

  // Ekstrak dan format elemen menjadi chunk yang seragam
  const chunks = [];
  for (const el of elements) {
    const text = (el.text || '').trim();
    if (!text) continue;

    // Deteksi judul/heading jika ada di metadata atau dari baris pertama
    const headingMatch = text.match(/^(BAB\s+[IVXLCDM]+.*?|Pasal\s+\d+.*?)(?:\n|$)/i);
    const heading = headingMatch 
      ? headingMatch[1].trim() 
      : (el.metadata?.title || el.metadata?.parent_id || 'Ketentuan Dokumen');

    chunks.push({
      text,
      heading,
      pageNumber: el.metadata?.page_number || 1,
      type: el.type || 'CompositeElement',
    });
  }

  return chunks;
}
