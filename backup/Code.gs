/**
 * It's Settled → Google Sheet backup.
 * Lives inside YOUR Google Sheet (Extensions → Apps Script). Nobody else needs a Google login.
 *
 * Every night the app POSTs a full snapshot here. This script:
 *   1. saves it as a JSON file in a private Drive folder "Its Settled backups" (keeps the last 60 per flat)
 *   2. rewrites a readable tab per flat with every expense, so you can read it in Sheets anytime
 * The app's "Restore from Google Sheet" calls doGet to fetch the latest snapshot.
 *
 * SECRET must match the BACKUP_SECRET you set on the Worker. Anyone without it is refused.
 */
const SECRET = 'PASTE-THE-SAME-LONG-RANDOM-SECRET-HERE';
const KEEP = 60;

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  if (!SECRET || body.key !== SECRET) return out({ error: 'Bad key' });
  const snap = body.snapshot, flatId = String(body.flatId || '').replace(/\W/g, '');
  if (!snap || snap.app !== 'its-settled' || !flatId) return out({ error: 'Not a backup snapshot' });

  // 1) JSON file in Drive (the real backup)
  const folder = getFolder_();
  const name = 'settled-' + flatId + '-' + snap.exported_at.slice(0, 10) + '.json';
  const same = folder.getFilesByName(name);
  if (same.hasNext()) same.next().setContent(JSON.stringify(snap));
  else folder.createFile(name, JSON.stringify(snap), 'application/json');
  prune_(folder, flatId);

  // 2) Human-readable tab
  writeSheet_(snap);
  return out({ ok: true, file: name });
}

function doGet(e) {
  const p = e.parameter || {};
  if (!SECRET || p.key !== SECRET) return out({ error: 'Bad key' });
  const files = listFor_(getFolder_(), String(p.flat || '').replace(/\W/g, ''));
  if (!files.length) return out({ error: 'No backups found for this flat yet' });
  return ContentService.createTextOutput(files[0].getBlob().getDataAsString()).setMimeType(ContentService.MimeType.JSON);
}

function writeSheet_(snap) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const title = ('Settled · ' + (snap.flat && snap.flat.name || 'Flat')).slice(0, 90);
  const sh = ss.getSheetByName(title) || ss.insertSheet(title);
  const name = {}; snap.members.forEach(m => name[m.id] = m.name);
  const rows = [['Date', 'Description', 'Type', 'Paid by', 'Amount', 'Split', 'Added via']];
  snap.expenses.slice().reverse().forEach(x => rows.push([
    new Date(x.created_at), x.description, x.kind, name[x.paid_by] || '?', x.amount / 100,
    x.split.map(s => (name[s[0]] || '?') + ' ' + (s[1] / 100)).join(', '), x.source,
  ]));
  sh.clearContents();
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange(1, 9).setValue('Last backup: ' + snap.exported_at);
}

function getFolder_() {
  const it = DriveApp.getFoldersByName('Its Settled backups');
  return it.hasNext() ? it.next() : DriveApp.createFolder('Its Settled backups');
}
function listFor_(folder, flatId) {
  const files = [], it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getName().indexOf('settled-' + flatId + '-') === 0) files.push(f); }
  return files.sort((a, b) => b.getName() < a.getName() ? -1 : 1); // newest first (date in name)
}
function prune_(folder, flatId) { listFor_(folder, flatId).slice(KEEP).forEach(f => f.setTrashed(true)); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
