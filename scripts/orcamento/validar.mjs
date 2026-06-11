// Valida a coluna "NE CCor" (col. 4) do .xlsx contra os notaEmpenho gravados
// na coleção opl_empenhos do Firestore. Reporta divergências nos dois sentidos.
//
// Uso: node scripts/orcamento/validar.mjs ["caminho/arquivo.xlsx"]
// Credencial: GOOGLE_APPLICATION_CREDENTIALS ou scripts/orcamento/serviceAccountKey.json

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const defaultXlsx = '/home/mozdam/Documents/AppsScript_Projeto/Empresa/Orçamento2026/TRE - RN - EXECUÇÃO (EMP_LIQ_PAGO) - por NE - PLEITOS ELEITORAIS - 2026.xlsx';
const xlsxPath = process.argv[2] || defaultXlsx;
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || join(__dirname, 'serviceAccountKey.json');

for (const [p, label] of [[xlsxPath, 'Planilha'], [serviceAccountPath, 'Credencial']]) {
  if (!existsSync(p)) { console.error(`❌ ${label} não encontrada: ${p}`); process.exit(1); }
}

// 1) NE CCor da planilha (coluna 4, dados a partir da linha 11 / índice 10)
const wb = readFile(xlsxPath);
const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

const NE_COL = 4;
const MES_COL0 = 16; // JAN/2026; meses em 16 + 3*mes (Emp/Liq/Pago)

const planilhaOcorrencias = []; // todas as linhas com NE
for (let i = 10; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;
  const ne = r[NE_COL];
  if (!ne) continue;
  let soma = 0;
  for (let m = 0; m < 12; m++) {
    soma += Number(r[MES_COL0 + m * 3] || 0) + Number(r[MES_COL0 + m * 3 + 1] || 0) + Number(r[MES_COL0 + m * 3 + 2] || 0);
  }
  planilhaOcorrencias.push({ ne: String(ne), zerado: soma === 0 });
}

const planilhaNEs = new Set(planilhaOcorrencias.map(o => o.ne));
const planilhaZeradas = new Set(planilhaOcorrencias.filter(o => o.zerado).map(o => o.ne));

// 2) notaEmpenho distintos no Firestore
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('opl_empenhos').get();
const dbNEs = new Set();
snap.forEach(doc => { const ne = doc.data().notaEmpenho; if (ne) dbNEs.add(String(ne)); });

// 3) Comparação
const soNaPlanilha = [...planilhaNEs].filter(ne => !dbNEs.has(ne)).sort();
const soNoBanco = [...dbNEs].filter(ne => !planilhaNEs.has(ne)).sort();

console.log('───────────────────────────────────────────────');
console.log('VALIDAÇÃO  NE CCor (planilha)  ×  opl_empenhos (Firestore)');
console.log('───────────────────────────────────────────────');
console.log(`Planilha — ocorrências (linhas com NE): ${planilhaOcorrencias.length}`);
console.log(`Planilha — NEs distintas:               ${planilhaNEs.size}`);
console.log(`Planilha — NEs com TODOS os meses = 0:   ${planilhaZeradas.size}`);
console.log(`Firestore — docs em opl_empenhos:        ${snap.size}`);
console.log(`Firestore — NEs distintas:               ${dbNEs.size}`);
console.log('───────────────────────────────────────────────');

if (soNaPlanilha.length === 0 && soNoBanco.length === 0) {
  console.log('✅ As NEs são exatamente as mesmas nos dois lados.');
} else {
  console.log(`⚠️  Divergências encontradas:`);
  if (soNaPlanilha.length) {
    console.log(`\n• ${soNaPlanilha.length} NE(s) na planilha e NÃO no banco:`);
    soNaPlanilha.forEach(ne => console.log(`    ${ne}${planilhaZeradas.has(ne) ? '   (todos os meses zerados → pulado na ingestão)' : '   ⚠ NÃO zerado'}`));
  }
  if (soNoBanco.length) {
    console.log(`\n• ${soNoBanco.length} NE(s) no banco e NÃO na planilha:`);
    soNoBanco.forEach(ne => console.log(`    ${ne}`));
  }
}
console.log('───────────────────────────────────────────────');
process.exit(0);
