// Ingestão do .xlsx do SPLE → coleção `opl_itens` (1 documento por linha).
// Replica a lógica de src/lib/opl-sple-xlsx.ts (parser duplicado, mesmo padrão de scripts/opl-serpro/upload.mjs).
//
// Uso: node scripts/opl-sple/upload.mjs ["caminho/arquivo.xlsx"] [--csv]
// Credencial: GOOGLE_APPLICATION_CREDENTIALS / SERVICE_ACCOUNT ou scripts/serviceAccountKey.json

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 22 abas de setor a processar (índices 5–26 da planilha). As demais abas são ignoradas.
const SETOR_SHEETS = [
  'ASCOM', 'CGI', 'COELE', 'NBE', 'NFA', 'NSI', 'SAMS', 'SDP', 'SECOP', 'SEGEAT', 'SENGE',
  'SEMAN', 'SEMAT', 'SEPAT', 'SETRAN', 'SGAE', 'SMI', 'SNT', 'SPLE', 'SSI', 'SRI', 'SUE',
];

const toNum = v =>
  typeof v === 'number' ? v : parseFloat(String(v ?? '0').replace(/\./g, '').replace(',', '.')) || 0;

const norm = s =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const findCol = (header, pred, fallback) => {
  const idx = header.findIndex(h => pred(norm(h)));
  return idx >= 0 ? idx : fallback;
};

const sanitize = s =>
  String(s ?? '').toUpperCase().replace(/[/.]/g, '').trim().replace(/\s+/g, '_');

function parseItens(sheets) {
  const out = [];
  const seqByBase = new Map();

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
      if (!pi) continue;

      const ua = String(row[0] ?? '').trim() || setor;
      const itemDespesa = String(row[cols.itemDespesa] ?? '').trim();
      const natMatch = itemDespesa.match(/\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{4}/);
      const naturezaDespesa = natMatch ? natMatch[0] : 'OUTROS';

      const seiNe = String(row[cols.seiNe] ?? '').trim();
      const vlrAprovado = toNum(row[cols.vlrAprovado]);
      const status = seiNe !== '' ? 'execucao' : vlrAprovado > 0 ? 'aprovacao' : 'lancamento';

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

// 1. Caminho do Excel e da credencial
const defaultExcelPath = join(__dirname, '../../_arquivos/ERD-pleitos/Orçamento Pleitos 2026 - Versão atual (Execução).xlsx');
const excelPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : defaultExcelPath;
const isCsvMode = process.argv.includes('--csv');
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.SERVICE_ACCOUNT ||
  join(__dirname, '../serviceAccountKey.json');

if (!existsSync(excelPath)) {
  console.error(`❌ Erro: Arquivo Excel não encontrado em: ${excelPath}`);
  process.exit(1);
}

// 2. Lê a planilha e monta as abas de SETOR_SHEETS
console.log(`📂 Lendo planilha: ${excelPath}`);
const workbook = readFile(excelPath);
const sheets = [];
for (const setor of SETOR_SHEETS) {
  const ws = workbook.Sheets[setor];
  if (!ws) {
    console.warn(`⚠️  Aba ausente na planilha: ${setor}`);
    continue;
  }
  sheets.push({ setor, rows: utils.sheet_to_json(ws, { header: 1 }) });
}

const itens = parseItens(sheets);
console.log(`📊 ${itens.length} itens parseados em ${sheets.length} abas.`);

// 3. Modo --csv: só imprime para conferência, sem gravar
if (isCsvMode) {
  console.log('DOC_ID,SETOR,UA,PI,NATUREZA,STATUS,APROVADO,EMPENHADO,SEI_NE');
  for (const { docId, data } of itens) {
    console.log([
      docId, data.setor, data.ua, data.pi, data.naturezaDespesa, data.status,
      data.vlrAprovado, data.vlrEmpenhado, JSON.stringify(data.seiNe),
    ].join(','));
  }
  process.exit(0);
}

// 4. Inicializa o Firebase Admin e grava
if (!existsSync(serviceAccountPath)) {
  console.error(`❌ Erro: Arquivo de credenciais não encontrado em: ${serviceAccountPath}`);
  process.exit(1);
}

let db;
try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  console.log('✅ Firebase Admin inicializado com sucesso.');
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
  process.exit(1);
}

const collectionRef = db.collection('opl_itens');
console.log(`🚀 Enviando ${itens.length} documentos para opl_itens...`);

let count = 0;
let batch = db.batch();
for (const item of itens) {
  batch.set(collectionRef.doc(item.docId), { ...item.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  count++;
  if (count % 500 === 0) {
    await batch.commit();
    console.log(`✅ ${count} documentos enviados...`);
    batch = db.batch();
  }
}
if (count % 500 !== 0) await batch.commit();

console.log(`✨ Sucesso! Total de ${count} documentos processados.`);
process.exit(0);
