import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Caminho da chave
const serviceAccountPath = process.env.SERVICE_ACCOUNT || join(__dirname, '../serviceAccountKey.json');

if (!existsSync(serviceAccountPath)) {
  console.error(`❌ Erro: Arquivo de credenciais não encontrado em: ${serviceAccountPath}`);
  process.exit(1);
}

// 2. Configurações do Excel
const defaultExcelPath = '/home/mozdam/Documents/AppsScript_Projeto/Empresa/Orçamento2026/TRE - RN - EXECUÇÃO (EMP_LIQ_PAGO) - por NE - PLEITOS ELEITORAIS - 2026.xlsx';
const excelPath = process.argv[2] || defaultExcelPath;
const anoReferencia = parseInt(process.argv[3] || '2026');
const isCsvMode = process.argv.includes('--csv');

if (!existsSync(excelPath)) {
  console.error(`❌ Erro: Arquivo Excel não encontrado em: ${excelPath}`);
  process.exit(1);
}

// 3. Inicialização do Firebase Admin (Sintaxe Modular)
let db;
try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount)
  });
  db = getFirestore();
  console.log('✅ Firebase Admin inicializado com sucesso.');
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
  process.exit(1);
}

async function runIngestion() {
  console.log(`📂 Lendo planilha: ${excelPath}`);
  const workbook = readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json(sheet, { header: 1 });

  const allData = [];
  let currentPtres = null;
  let currentPlanoOrc = null;

  console.log('⏳ Processando dados mensais...');

  for (let i = 10; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    if (row[0]) currentPtres = row[0];
    if (row[1]) currentPlanoOrc = row[1];

    const notaEmpenho = row[4];
    if (!notaEmpenho) continue;

    // A NE tem algum valor em algum mês? Se não tiver (empenho sem entrada),
    // gravamos os 12 meses zerados para que ela exista no banco.
    let neHasMovement = false;
    for (let mes = 0; mes < 12; mes++) {
      const c = 16 + mes * 3;
      if ((parseFloat(row[c] || 0)) || (parseFloat(row[c + 1] || 0)) || (parseFloat(row[c + 2] || 0))) {
        neHasMovement = true;
        break;
      }
    }

    for (let mes = 0; mes < 12; mes++) {
      const colStart = 16 + (mes * 3);
      const emp = parseFloat(row[colStart] || 0);
      const liq = parseFloat(row[colStart + 1] || 0);
      const pag = parseFloat(row[colStart + 2] || 0);

      if (emp === 0 && liq === 0 && pag === 0 && neHasMovement) continue;

      const mesCode = `${anoReferencia}-${String(mes + 1).padStart(2, '0')}`;
      const referenciaDate = new Date(anoReferencia, mes, 1);

      allData.push({
        docId: `${mesCode}__${notaEmpenho}`,
        data: {
          referencia: Timestamp.fromDate(referenciaDate),
          ptres: Number(currentPtres),
          planoOrcamentario: String(currentPlanoOrc),
          notaEmpenho: String(notaEmpenho),
          planoIntegrado: String(row[5] || ''),
          descricao: String(row[6] || ''),
          naturezaDespesa: String(row[9] || ''),
          processoSei: String(row[10] || ''),
          fornecedores: String(row[13] || ''),
          despesasEmpenhadas: emp,
          despesasLiquidadas: liq,
          despesasPagas: pag,
          ano: anoReferencia,
          mesCode,
          updatedAt: FieldValue.serverTimestamp()
        }
      });
    }
  }

  allData.sort((a, b) => a.data.mesCode.localeCompare(b.data.mesCode));

  if (isCsvMode) {
    console.log('REFERÊNCIA,PTRES,NOTA_EMPENHO,EMPENHADO,LIQUIDADO,PAGO');
    allData.forEach(item => {
      console.log(`${item.data.mesCode},${item.data.ptres},${item.data.notaEmpenho},${item.data.despesasEmpenhadas},${item.data.despesasLiquidadas},${item.data.despesasPagas}`);
    });
    return;
  }

  console.log(`🚀 Enviando ${allData.length} documentos para o Firestore...`);
  const collectionRef = db.collection('opl_empenhos');

  // Lê o estado atual para registrar prev*/prev2*/prev3* com guarda por valor: só "rola" o
  // histórico quando o valor muda (se igual, omite e o merge preserva). Preserva 3 ciclos — ao
  // mudar, prev2→prev3, prev→prev2 (com seus carimbos) e o atual vira o novo prev.
  console.log('⏳ Lendo estado atual para comparação semana-a-semana...');
  const existingSnap = await collectionRef.get();
  const existing = new Map();
  existingSnap.forEach(doc => existing.set(doc.id, doc.data()));
  const runAt = Timestamp.fromDate(new Date());

  let count = 0;
  let batch = db.batch();

  for (const item of allData) {
    const cur = existing.get(item.docId);
    if (cur) {
      if (cur.despesasEmpenhadas !== undefined && item.data.despesasEmpenhadas !== cur.despesasEmpenhadas) {
        if (cur.prev2Empenhadas !== undefined) {
          item.data.prev3Empenhadas = cur.prev2Empenhadas;
          item.data.prev3EmpenhadasAt = cur.prev2EmpenhadasAt ?? runAt;
        }
        if (cur.prevEmpenhadas !== undefined) {
          item.data.prev2Empenhadas = cur.prevEmpenhadas;
          item.data.prev2EmpenhadasAt = cur.prevEmpenhadasAt ?? runAt;
        }
        item.data.prevEmpenhadas = cur.despesasEmpenhadas;
        item.data.prevEmpenhadasAt = runAt;
      }
      if (cur.despesasLiquidadas !== undefined && item.data.despesasLiquidadas !== cur.despesasLiquidadas) {
        if (cur.prev2Liquidadas !== undefined) {
          item.data.prev3Liquidadas = cur.prev2Liquidadas;
          item.data.prev3LiquidadasAt = cur.prev2LiquidadasAt ?? runAt;
        }
        if (cur.prevLiquidadas !== undefined) {
          item.data.prev2Liquidadas = cur.prevLiquidadas;
          item.data.prev2LiquidadasAt = cur.prevLiquidadasAt ?? runAt;
        }
        item.data.prevLiquidadas = cur.despesasLiquidadas;
        item.data.prevLiquidadasAt = runAt;
      }
      if (cur.despesasPagas !== undefined && item.data.despesasPagas !== cur.despesasPagas) {
        if (cur.prev2Pagas !== undefined) {
          item.data.prev3Pagas = cur.prev2Pagas;
          item.data.prev3PagasAt = cur.prev2PagasAt ?? runAt;
        }
        if (cur.prevPagas !== undefined) {
          item.data.prev2Pagas = cur.prevPagas;
          item.data.prev2PagasAt = cur.prevPagasAt ?? runAt;
        }
        item.data.prevPagas = cur.despesasPagas;
        item.data.prevPagasAt = runAt;
      }
    }

    const docRef = collectionRef.doc(item.docId);
    batch.set(docRef, item.data, { merge: true });
    count++;

    if (count % 500 === 0) {
      await batch.commit();
      console.log(`✅ ${count} documentos enviados...`);
      batch = db.batch();
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`✨ Sucesso! Total de ${count} documentos processados.`);
  process.exit(0);
}

runIngestion().catch(err => {
  console.error('❌ Erro fatal durante a ingestão:', err);
  process.exit(1);
});
