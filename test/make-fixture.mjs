// Generates test/fixtures/tricount-sample.csv: a synthetic Tricount export with made-up people.
// Mirrors real-export quirks: rounded split amounts that don't add up, blank vs "+05:30" timezones,
// uneven splits (2 of 3 people, one person), plus one money transfer and one income row.
import fs from 'fs';
const people = ['Asha', 'Ben', 'Chen'];
const head = '"Who paid","Amount","Currency","For whom","Split amounts","Purpose","Category","Date & time","Timezone","Exchange rate","Converted amount","Type","Receipt"';
const q = v => `"${v}"`;
const rows = [];
let seed = 7;
const rnd = n => (seed = (seed * 16807) % 2147483647) % n;
const purposes = ['Groceries', 'Maid', 'Cook', 'Wifi', 'Electricity bill', 'Maintenance', 'Gas cylinder', 'Water cans', 'Dinner out'];
for (let i = 0; i < 40; i++) {
  const payer = people[rnd(3)], amount = [450, 509, 788, 1600, 4000, 4642, 5099, 7400, 8500][rnd(9)];
  const who = [people, people, people, people.filter(p => p !== people[(i + 1) % 3]), [people[rnd(3)]]][rnd(5)];
  const share = (amount / who.length).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  const d = new Date(Date.UTC(2026, 1 + Math.floor(i / 5), 1 + (i % 5) * 5, 3 + rnd(12), rnd(60), rnd(60)));
  rows.push([payer, amount, 'INR', who.join(';'), who.map(() => share).join(';'), purposes[rnd(9)] + (rnd(3) ? '' : ' '), ' ',
    d.toISOString().slice(0, 19).replace('T', ' '), rnd(2) ? '+05:30' : '', '', amount, 'expense', ''].map(q).join(','));
}
rows.push(['Chen', 2000, 'INR', 'Asha', 2000, 'Paid back', ' ', '2026-06-20 10:00:00', '+05:30', '', 2000, 'money transfer', ''].map(q).join(','));
rows.push(['Ben', 300, 'INR', 'Asha;Ben;Chen', '100;100;100', 'Deposit refund', ' ', '2026-06-21 10:00:00', '', '', 300, 'income', ''].map(q).join(','));
fs.mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./fixtures/tricount-sample.csv', import.meta.url), head + '\n' + rows.join('\n') + '\n');
console.log('wrote fixture with', rows.length, 'rows');
