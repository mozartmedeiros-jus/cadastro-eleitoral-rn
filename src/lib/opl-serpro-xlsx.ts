// Parser do .xlsx de execução orçamentária (Pleitos), para uso no cliente.
// Replica fielmente a lógica de scripts/upload-orcamento.mjs (etapa de extração mensal):
// dados a partir da linha 11 (índice 10), forward-fill de PTRES e Plano Orçamentário,
// 12 blocos mensais (Emp/Liq/Pago em colunas 17/18/19 + 3*mês), pulando meses zerados.
//
// `referencia` é uma Date; o Firestore client SDK a converte em Timestamp ao gravar.
// `updatedAt` (serverTimestamp) é adicionado na hora da gravação, não aqui.

export interface EmpenhoDocData {
  referencia: Date;
  ptres: number;
  planoOrcamentario: string;
  notaEmpenho: string;
  planoIntegrado: string;
  descricao: string;
  naturezaDespesa: string;
  processoSei: string;
  fornecedores: string;
  despesasEmpenhadas: number;
  despesasLiquidadas: number;
  despesasPagas: number;
  ano: number;
  mesCode: string;
}

export interface ParsedEmpenho {
  docId: string;
  data: EmpenhoDocData;
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Converte as linhas brutas da planilha (sheet_to_json com header:1) em documentos
 * prontos para gravar em `opl_empenhos`. Retorna [] se não houver linhas válidas.
 */
export function parseEmpenhos(rows: unknown[][], ano = 2026): ParsedEmpenho[] {
  const out: ParsedEmpenho[] = [];
  let currentPtres: unknown = null;
  let currentPlanoOrc: unknown = null;

  for (let i = 10; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Células mescladas na origem → forward-fill.
    if (row[0]) currentPtres = row[0];
    if (row[1]) currentPlanoOrc = row[1];

    const notaEmpenho = row[4];
    if (!notaEmpenho) continue; // linha sem NE é descartada

    // A NE tem algum valor em algum mês? Se não (empenho sem entrada), gravamos
    // os 12 meses zerados para que ela exista no banco.
    let neHasMovement = false;
    for (let mes = 0; mes < 12; mes++) {
      const c = 16 + mes * 3;
      if (toNumber(row[c]) || toNumber(row[c + 1]) || toNumber(row[c + 2])) {
        neHasMovement = true;
        break;
      }
    }

    for (let mes = 0; mes < 12; mes++) {
      const colStart = 16 + mes * 3;
      const emp = toNumber(row[colStart]);
      const liq = toNumber(row[colStart + 1]);
      const pag = toNumber(row[colStart + 2]);

      if (emp === 0 && liq === 0 && pag === 0 && neHasMovement) continue; // mês sem movimento (NE com entrada em outro mês)

      const mesCode = `${ano}-${String(mes + 1).padStart(2, '0')}`;
      out.push({
        docId: `${mesCode}__${notaEmpenho}`,
        data: {
          referencia: new Date(ano, mes, 1),
          ptres: Number(currentPtres),
          planoOrcamentario: String(currentPlanoOrc ?? ''),
          notaEmpenho: String(notaEmpenho),
          planoIntegrado: String(row[5] ?? ''),
          descricao: String(row[6] ?? ''),
          naturezaDespesa: String(row[9] ?? ''),
          processoSei: String(row[10] ?? ''),
          fornecedores: String(row[13] ?? ''),
          despesasEmpenhadas: emp,
          despesasLiquidadas: liq,
          despesasPagas: pag,
          ano,
          mesCode,
        },
      });
    }
  }

  return out;
}
