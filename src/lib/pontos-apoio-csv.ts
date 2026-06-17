// Fonte ÚNICA de Pontos de Apoio: CSV público de uma planilha Google, buscado AO VIVO
// via fetch (sem Firestore, sem ingestão). Compatível com export estático.
// Colunas (cabeçalho com "PONTO DE APOIO" duplicado), parseadas POR ÍNDICE
// (sheet_to_json com header:1), nunca por objeto:
//   0 ZONA · 1 MUNICÍPIO · 2 PONTO DE APOIO (local) · 3 ENDEREÇO ·
//   4 FUNCIONAMENTO · 5 PONTO DE TRANSMISSÃO · 6 PONTO DE APOIO (apoio: APOIO/EXCLUIR)
// A coluna 6 (apoio) pode ainda não estar no CSV publicado; nesse caso vem vazia.

export interface PontoApoio {
  zona: string;
  municipio: string;
  local: string;
  endereco: string;
  funcionamento: string;
  transmissao: boolean;
  apoio: string;
}

export const PONTOS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT0Gx6xtIsEHPf0qPRQyTtI1oDw8bWxy8Z2U6HH8e2qBMhI2hCCRENxTlmBRB06yGt6GO91d9LpWGfU/pub?gid=788421395&single=true&output=csv';

export async function fetchPontos(url: string): Promise<PontoApoio[]> {
  // xlsx@0.18 não tem default export; sob Turbopack o namespace expõe read/utils direto.
  const XLSXmod = await import('xlsx');
  const XLSX = XLSXmod.default ?? XLSXmod;

  // cache-busting: a URL já tem '?', então usamos '&'
  const res = await fetch(`${url}&_t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Falha ao buscar os dados (HTTP ${res.status}).`);
  }

  const text = await res.text();
  const wb = XLSX.read(text, { type: 'string' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  const out: PontoApoio[] = [];
  // Pula a linha 0 (cabeçalho).
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const zona = String(row[0] ?? '').trim();
    const municipio = String(row[1] ?? '').trim();
    const local = String(row[2] ?? '').trim();
    const endereco = String(row[3] ?? '').trim();
    const funcionamento = String(row[4] ?? '').trim();
    const transmissao = String(row[5] ?? '').trim() !== '';
    const apoio = String(row[6] ?? '').trim();

    // Pula linhas inteiramente vazias.
    if (!zona && !municipio && !local && !endereco && !funcionamento && !transmissao && !apoio) {
      continue;
    }

    out.push({ zona, municipio, local, endereco, funcionamento, transmissao, apoio });
  }

  return out;
}
