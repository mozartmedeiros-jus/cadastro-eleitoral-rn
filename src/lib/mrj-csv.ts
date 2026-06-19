// Fonte ÚNICA das Mesas Receptoras de Justificativa (MRJ): CSV público de uma planilha
// Google, buscado AO VIVO via fetch (sem Firestore, sem ingestão). Compatível com export estático.
// Colunas (a última com cabeçalho em 2 linhas), parseadas POR ÍNDICE (sheet_to_json com header:1),
// nunca por objeto:
//   0 ZONA · 1 MUNICÍPIO · 2 MRJ (NOME DO LOCAL) · 3 ENDEREÇO ·
//   4 1º TURNO (bool) · 5 2º TURNO (bool) · 6 "2º TURNO SEM VOTAÇÃO NO RN" (bool TRUE/FALSE)
// O nome do local "NÃO HAVERÁ MRJ" sinaliza município sem MRJ (ver SEM_MRJ / temMrj).

export interface MesaMrj {
  zona: string;
  municipio: string;
  local: string;
  endereco: string;
  primeiroTurno: boolean;
  segundoTurno: boolean;
  segundoTurnoSemVotacao: boolean;
}

export const MRJ_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT0Gx6xtIsEHPf0qPRQyTtI1oDw8bWxy8Z2U6HH8e2qBMhI2hCCRENxTlmBRB06yGt6GO91d9LpWGfU/pub?gid=556434340&single=true&output=csv';

// Sentinela do nome do local para município sem Mesa Receptora de Justificativa.
export const SEM_MRJ = 'NÃO HAVERÁ MRJ';

export function temMrj(m: MesaMrj): boolean {
  return m.local.trim().toUpperCase() !== SEM_MRJ;
}

export async function fetchMrj(url: string): Promise<MesaMrj[]> {
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

  // Robusto a TRUE/FALSE em texto OU já convertido para boolean pelo SheetJS.
  const bool = (v: unknown) => String(v ?? '').trim().toUpperCase() === 'TRUE';

  const out: MesaMrj[] = [];
  // Pula a linha 0 (cabeçalho).
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const zona = String(row[0] ?? '').trim();
    const municipio = String(row[1] ?? '').trim();
    const local = String(row[2] ?? '').trim();
    const endereco = String(row[3] ?? '').trim();
    const primeiroTurno = bool(row[4]);
    const segundoTurno = bool(row[5]);
    const segundoTurnoSemVotacao = bool(row[6]);

    // Pula linhas inteiramente vazias.
    if (!zona && !municipio && !local && !endereco && !primeiroTurno && !segundoTurno && !segundoTurnoSemVotacao) {
      continue;
    }

    out.push({ zona, municipio, local, endereco, primeiroTurno, segundoTurno, segundoTurnoSemVotacao });
  }

  return out;
}
