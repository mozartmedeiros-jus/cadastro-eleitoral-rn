// Parser do .xlsx do SPLE (Gestão da execução orçamentária — Pleitos 2026), lib-agnóstico.
// Recebe as linhas já extraídas (sheet_to_json com header:1) de cada aba de setor e devolve
// 1 documento por linha para a coleção `opl_itens`. Replica o padrão de src/lib/opl-serpro-xlsx.ts.
//
// `updatedAt` (serverTimestamp) é adicionado na hora da gravação, não aqui.

export interface ItemOplData {
  setor: string;            // nome da aba
  ua: string;               // col 0 || nome da aba
  pi: string;
  despesaAgregada: string;
  itemDespesa: string;      // string completa
  naturezaDespesa: string;  // código extraído de itemDespesa, ou "OUTROS"

  vlrPropostaRef: number;   // col 4 (header começa com "PROPOSTA")
  vlrUnidade: number;       // LANÇAMENTO DAS UNIDADES
  memoriaCalculo: string;   // 1ª "Memória de cálculo"

  vlrAjusteStie: number;
  vlrAprovacaoCogel: number;
  vlrAprovado: number;

  seiNe: string;            // '' se ausente
  vlrEstimado: number;
  vlrEmpenhado: number;
  vlrPago: number;
  justificativa: string;

  status: 'lancamento' | 'aprovacao' | 'execucao';
  ano: number;              // 2026
}

export interface ParsedItem {
  docId: string;
  data: ItemOplData;
}

// 22 abas de setor a processar (índices 5–26 da planilha). As demais abas são ignoradas.
export const SETOR_SHEETS: string[] = [
  'ASCOM', 'CGI', 'COELE', 'NBE', 'NFA', 'NSI', 'SAMS', 'SDP', 'SECOP', 'SEGEAT', 'SENGE',
  'SEMAN', 'SEMAT', 'SEPAT', 'SETRAN', 'SGAE', 'SMI', 'SNT', 'SPLE', 'SSI', 'SRI', 'SUE',
];

// Conversão robusta de valor monetário: número passa direto; string "1.234,56" → 1234.56.
function toNum(v: unknown): number {
  return typeof v === 'number'
    ? v
    : parseFloat(String(v ?? '0').replace(/\./g, '').replace(',', '.')) || 0;
}

// Normaliza um header para comparação: sem acento, minúsculo, espaços/quebras colapsados.
function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Acha o índice da coluna pelo header; cai para a posição esperada quando o header não bate.
function findCol(header: unknown[], pred: (h: string) => boolean, fallback: number): number {
  const idx = header.findIndex(h => pred(norm(h)));
  return idx >= 0 ? idx : fallback;
}

// Sanitiza um pedaço do doc ID: maiúsculo, remove / e ., espaços→_.
function sanitize(s: unknown): string {
  return String(s ?? '')
    .toUpperCase()
    .replace(/[/.]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

/**
 * Converte as abas de setor (cada uma com suas linhas brutas) em documentos `opl_itens`.
 * 1 documento por linha (PI não-vazio). O doc ID recebe um sufixo de sequência `__NN` por
 * grupo de mesma chave natural (UA, PI, naturezaDespesa) para evitar colisão.
 */
export function parseItens(sheets: { setor: string; rows: unknown[][] }[]): ParsedItem[] {
  const out: ParsedItem[] = [];
  const seqByBase = new Map<string, number>();

  for (const { setor, rows } of sheets) {
    if (!rows || rows.length < 2) continue;
    const header = rows[0] ?? [];

    const cols = {
      pi: findCol(header, h => h === 'pi', 1),
      despesaAgregada: findCol(header, h => h === 'despesa agregada', 2),
      itemDespesa: findCol(header, h => h === 'item da despesa', 3),
      vlrPropostaRef: findCol(header, h => h.startsWith('proposta'), 4),
      vlrUnidade: findCol(header, h => h === 'lancamento das unidades', 5),
      memoriaCalculo: findCol(header, h => h === 'memoria de calculo', 6),
      vlrAjusteStie: findCol(header, h => h === 'ajustes stie', 7),
      vlrAprovacaoCogel: findCol(header, h => h.includes('cogel'), 8),
      vlrAprovado: findCol(header, h => h === 'aprovacao do orcamento', 9),
      seiNe: findCol(header, h => h.startsWith('sei execucao'), 10),
      vlrEstimado: findCol(header, h => h === 'valor estimado', 11),
      vlrEmpenhado: findCol(header, h => h === 'valor empenhado', 12),
      vlrPago: findCol(header, h => h === 'valor pago', 13),
      justificativa: findCol(header, h => h === 'justificativa', 16),
    };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const pi = String(row[cols.pi] ?? '').trim();
      if (!pi) continue; // linha sem PI é descartada

      const ua = String(row[0] ?? '').trim() || setor;
      const itemDespesa = String(row[cols.itemDespesa] ?? '').trim();
      const natMatch = itemDespesa.match(/\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{4}/);
      const naturezaDespesa = natMatch ? natMatch[0] : 'OUTROS';

      const seiNe = String(row[cols.seiNe] ?? '').trim();
      const vlrAprovado = toNum(row[cols.vlrAprovado]);
      const status: ItemOplData['status'] =
        seiNe !== '' ? 'execucao' : vlrAprovado > 0 ? 'aprovacao' : 'lancamento';

      const base = `2026__${sanitize(ua)}__${sanitize(pi)}__${sanitize(naturezaDespesa)}`.slice(0, 146);
      const seq = (seqByBase.get(base) ?? 0) + 1;
      seqByBase.set(base, seq);
      const docId = `${base}__${String(seq).padStart(2, '0')}`;

      out.push({
        docId,
        data: {
          setor,
          ua,
          pi,
          despesaAgregada: String(row[cols.despesaAgregada] ?? '').trim(),
          itemDespesa,
          naturezaDespesa,
          vlrPropostaRef: toNum(row[cols.vlrPropostaRef]),
          vlrUnidade: toNum(row[cols.vlrUnidade]),
          memoriaCalculo: String(row[cols.memoriaCalculo] ?? '').trim(),
          vlrAjusteStie: toNum(row[cols.vlrAjusteStie]),
          vlrAprovacaoCogel: toNum(row[cols.vlrAprovacaoCogel]),
          vlrAprovado,
          seiNe,
          vlrEstimado: toNum(row[cols.vlrEstimado]),
          vlrEmpenhado: toNum(row[cols.vlrEmpenhado]),
          vlrPago: toNum(row[cols.vlrPago]),
          justificativa: String(row[cols.justificativa] ?? '').trim(),
          status,
          ano: 2026,
        },
      });
    }
  }

  return out;
}
