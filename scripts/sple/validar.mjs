// Valida a contagem de linhas da planilha (PI não-vazio nas 22 abas de setor) contra os
// documentos gravados em opl_itens no Firestore. Reporta por setor e o total, sinalizando
// divergências (prova de que não há colisão de doc ID).
//
// Uso: node scripts/sple/validar.mjs ["caminho/arquivo.xlsx"]
// Credencial: GOOGLE_APPLICATION_CREDENTIALS / SERVICE_ACCOUNT ou scripts/orcamento/serviceAccountKey.json

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SETOR_SHEETS = [
  'ASCOM', 'CGI', 'COELE', 'NBE', 'NFA', 'NSI', 'SAMS', 'SDP', 'SECOP', 'SEGEAT', 'SENGE',
  'SEMAN', 'SEMAT', 'SEPAT', 'SETRAN', 'SGAE', 'SMI', 'SNT', 'SPLE', 'SSI', 'SRI', 'SUE',
];

const defaultXlsx = join(__dirname, '../../_arquivos/ERD-pleitos/Orçamento Pleitos 2026 - Versão atual (Execução).xlsx');
const xlsxPath = process.argv[2] || defaultXlsx;
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.SERVICE_ACCOUNT ||
  join(__dirname, '../orcamento/serviceAccountKey.json');

for (const [p, label] of [[xlsxPath, 'Planilha'], [serviceAccountPath, 'Credencial']]) {
  if (!existsSync(p)) { console.error(`❌ ${label} não encontrada: ${p}`); process.exit(1); }
}

// 1) Contagem da planilha: linhas com PI (col 1) não-vazio, por setor
const wb = readFile(xlsxPath);
const planilha = new Map(); // setor → contagem
let totalPlanilha = 0;
for (const setor of SETOR_SHEETS) {
  const ws = wb.Sheets[setor];
  if (!ws) { console.warn(`⚠️  Aba ausente: ${setor}`); planilha.set(setor, 0); continue; }
  const rows = utils.sheet_to_json(ws, { header: 1 });
  let cnt = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r && String(r[1] ?? '').trim() !== '') cnt++;
  }
  planilha.set(setor, cnt);
  totalPlanilha += cnt;
}

// 2) Contagem do Firestore: docs em opl_itens, por setor
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('opl_itens').get();
const banco = new Map();
snap.forEach(doc => {
  const setor = doc.data().setor ?? '(sem setor)';
  banco.set(setor, (banco.get(setor) ?? 0) + 1);
});

// 3) Comparação
console.log('──────────────────────────────────────────────');
console.log('VALIDAÇÃO  planilha (PI não-vazio)  ×  opl_itens (Firestore)');
console.log('──────────────────────────────────────────────');
console.log('SETOR        PLANILHA   BANCO   STATUS');
let divergencias = 0;
for (const setor of SETOR_SHEETS) {
  const p = planilha.get(setor) ?? 0;
  const b = banco.get(setor) ?? 0;
  const ok = p === b;
  if (!ok) divergencias++;
  console.log(`${setor.padEnd(11)} ${String(p).padStart(8)} ${String(b).padStart(7)}   ${ok ? '✓' : '⚠ DIVERGE'}`);
}
console.log('──────────────────────────────────────────────');
console.log(`TOTAL        ${String(totalPlanilha).padStart(8)} ${String(snap.size).padStart(7)}`);
console.log('──────────────────────────────────────────────');

// Setores presentes no banco mas fora da lista de abas (lixo de ingestão anterior)
const extras = [...banco.keys()].filter(s => !SETOR_SHEETS.includes(s));
if (extras.length) {
  console.log(`⚠️  Setores no banco fora das 22 abas: ${extras.join(', ')}`);
  divergencias += extras.length;
}

if (divergencias === 0 && totalPlanilha === snap.size) {
  console.log('✅ Contagem bate em todos os setores e no total — sem colisão de ID.');
} else {
  console.log(`⚠️  ${divergencias} divergência(s) encontrada(s).`);
}
process.exit(0);
