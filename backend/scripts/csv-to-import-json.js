const fs = require('fs');
const path = require('path');

const csvPath = process.argv[2] || path.join(process.env.HOME || '', 'Downloads', 'Новая таблица - сч.120; спец.одежда.csv');
const csv = fs.readFileSync(csvPath, 'utf8');

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || (c === '\n' && !inQuotes)) {
      fields.push(current.replace(/^"|"$/g, '').trim());
      current = '';
      if (c === '\n') break;
    } else {
      current += c;
    }
  }
  if (current !== '') fields.push(current.replace(/^"|"$/g, '').trim());
  return fields;
}

function parseNum(s) {
  if (s == null || s === '') return 0;
  const n = parseFloat(String(s).trim().replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

const lines = csv.split(/\r?\n/).filter((l) => l.trim());
const header = lines[0];
const dataLines = lines.slice(1);

const out = [];
for (const line of dataLines) {
  const cols = parseCsvLine(line + (line.endsWith(',') ? '' : ','));
  const name = (cols[0] || '').trim();
  if (!name) continue;

  const unit = (cols[1] || 'шт').trim().replace(/\.$/, '') || 'шт';
  const quantity = parseNum(cols[2]);
  const price = parseNum(cols[3]);
  const sum = parseNum(cols[4]);
  const supplier = (cols[5] || '').trim();
  const ttnDate = (cols[6] || '').trim();
  const ttnNum = (cols[7] || '').trim();

  let ttnNumber = '';
  if (ttnNum && ttnDate) {
    ttnNumber = `${ttnNum} ${ttnDate}`;
  } else if (ttnNum) {
    ttnNumber = ttnNum.replace(/\s*;\s*/g, ' ');
  } else if (ttnDate) {
    ttnNumber = ttnDate;
  }

  out.push({
    name,
    unit,
    quantity: Math.round(quantity * 100) / 100,
    price: Math.round(price * 100) / 100,
    sum: Math.round(sum * 100) / 100,
    supplier,
    ttnNumber,
  });
}

const outPath = path.join(__dirname, '..', 'import-сч120-спецодежда.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Written', out.length, 'items to', outPath);
