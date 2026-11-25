/**
 * Likhi access checker — paste this into your Google Sheet (Extensions → Apps Script).
 * Likhi asks it "does this phone number + access code match?" and it only answers yes or no.
 * Nobody can see your sheet through it.
 *
 * Sheet tab name: Access
 * Row 1 headings (A–I): Phone | Access code | Name | Institution | Active | Max devices | Devices | Last login | Notes
 */
const SHEET_NAME = 'Access';
const DEFAULT_MAX_DEVICES = 2;
const COL = { phone: 1, code: 2, name: 3, inst: 4, active: 5, max: 6, devices: 7, last: 8 };

// Likhi sends: { action: 'login' | 'check' | 'logout', phone, code, device, platform, version }
function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents || '{}'); } catch (err) { return reply({ ok: false, reason: 'bad' }); }
  return reply(handle(req));
}
// Open the web app link in a browser to see that it works.
// Test a row without using a device slot:  ...exec?action=test&phone=01712345678&code=RAHIM-4821
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'test') return reply(handle({ action: 'test', phone: p.phone, code: p.code }));
  return reply({ likhi: 'ok', message: 'The Likhi access checker is working.' });
}

function handle(req) {
  const phone = normPhone(req.phone), code = String(req.code || '').trim().toUpperCase();
  const device = String(req.device || '').replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 40);
  if (!phone || !code) return { ok: false, reason: 'nomatch' };

  // stop guessing: 8 wrong tries for one number → wait 15 minutes
  const cache = CacheService.getScriptCache(), failKey = 'fail_' + phone;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 8) return { ok: false, reason: 'wait' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return { ok: false, reason: 'setup' };
    const rows = sheet.getDataRange().getValues();
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (normPhone(row[COL.phone - 1]) !== phone) continue;
      if (String(row[COL.code - 1]).trim().toUpperCase() !== code) continue;
      cache.remove(failKey);
      const active = String(row[COL.active - 1]).trim().toLowerCase();
      if (active === 'no' || active === 'false' || active === 'blocked') return { ok: false, reason: 'inactive' };
      const max = Number(row[COL.max - 1]) > 0 ? Number(row[COL.max - 1]) : DEFAULT_MAX_DEVICES;
      let list = String(row[COL.devices - 1] || '').split(',').map(s => s.trim()).filter(Boolean);
      const name = String(row[COL.name - 1] || '');
      if (req.action === 'test') return { ok: true, name, maxDevices: max, used: list.length };
      if (req.action === 'logout') {
        list = list.filter(d => d !== device);
        sheet.getRange(r + 1, COL.devices).setValue(list.join(', '));
        return { ok: true };
      }
      if (!device) return { ok: false, reason: 'bad' };
      if (list.indexOf(device) < 0) {                   // a new device: only if there's room
        if (list.length >= max) return { ok: false, reason: 'devices', maxDevices: max };
        list.push(device);
        sheet.getRange(r + 1, COL.devices).setValue(list.join(', '));
      }
      sheet.getRange(r + 1, COL.last).setValue(new Date());
      return { ok: true, name, maxDevices: max, used: list.length };
    }
    cache.put(failKey, String(fails + 1), 900);
    return { ok: false, reason: 'nomatch' };
  } finally {
    lock.releaseLock();
  }
}

// 01712345678, +8801712345678, 8801712-345678 and 1712345678 all become 01712345678
function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.indexOf('880') === 0) d = '0' + d.slice(3);
  else if (d.length === 10 && d[0] === '1') d = '0' + d;
  return d;
}
function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
