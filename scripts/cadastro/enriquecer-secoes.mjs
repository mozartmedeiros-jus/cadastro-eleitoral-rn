import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync, writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const XLSX = require('xlsx');

const XLSX_PATH = path.join(__dirname, '../../_arquivos/ESTATISTICA_SECAO_ELEITORAL_08-06-2026.xlsx');
const JSON_PATH = path.join(__dirname, '../../data/cadastro_eleitoral.json');

// 1. Ler xlsx
const wb = XLSX.readFile(XLSX_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

// 2. Montar lookup por "zona__municipio__local__secao"
// Colunas: ZONA, MUNICIPIO, LOCAL, SECAO, QTD_APTOS,
//          QDE_ANALFABETOS, PERC_ANALFABETOS, QDE_IDOSOS, PERC_IDOSOS,
//          QDE_LE_ESCREVE, PERC_LE_ESCREVE, QDE_ELEIT_C_DEFIC, ELEIT_C_DEFIC (perc), SITUACAO_SECAO
const lookup = new Map();
for (const r of rows) {
  const key = [
    String(r.ZONA).trim(),
    String(r.MUNICIPIO).trim().toUpperCase(),
    String(r.LOCAL).trim().toUpperCase(),
    String(r.SECAO).trim(),
  ].join('__');
  lookup.set(key, {
    qde_idosos: r.QDE_IDOSOS ?? null,
    perc_idosos: r.PERC_IDOSOS ?? null,
    qde_eleit_c_defic: r.QDE_ELEIT_C_DEFIC ?? null,
    perc_eleit_c_defic: r.ELEIT_C_DEFIC ?? null,     // coluna 13: percentual de deficientes
    qde_analfabetos: r.QDE_ANALFABETOS ?? null,
    perc_analfabetos: r.PERC_ANALFABETOS ?? null,
  });
}

console.log(`Lookup montado: ${lookup.size} seções no xlsx.`);

// 3. Ler JSON atual
const cadastro = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

// 4. Enriquecer secoes_detalhes de cada local
let matched = 0;
let missed = 0;

for (const local of cadastro) {
  if (!Array.isArray(local.secoes_detalhes)) continue;
  for (const s of local.secoes_detalhes) {
    const key = [
      String(local.zona).trim(),
      String(local.municipio).trim().toUpperCase(),
      String(local.local).trim().toUpperCase(),
      String(s.secao).trim(),
    ].join('__');
    const stats = lookup.get(key);
    if (stats) {
      Object.assign(s, stats);
      matched++;
    } else {
      missed++;
      if (missed <= 5) console.warn(`  Não encontrado: ${key}`);
    }
  }
}

// 5. Gravar JSON enriquecido
writeFileSync(JSON_PATH, JSON.stringify(cadastro, null, 2), 'utf-8');

console.log(`\nConcluído: ${matched} seções enriquecidas, ${missed} não encontradas.`);
