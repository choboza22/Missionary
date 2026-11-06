/**
 * 쉼을 찾아서 — 무료 백엔드 (Google Apps Script)
 * 사진은 Drive 폴더, 기도문·진행상황은 이 스프레드시트에 저장됩니다.
 * 설정: README.md 의 "백엔드 설정" 참고
 */
const FOLDER_NAME = '쉼을찾아서-사진';

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); }
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const t = d.ts || new Date().toISOString();
    if (d.type === 'prayer') {
      sheet_('기도문', ['시각', '조', '이름', '나를 위한 기도', '옆 사람을 위한 기도', 'id']).appendRow([t, d.group, d.name, d.mine, d.neighbor || '', d.id]);
    } else if (d.type === 'photo') {
      const it = DriveApp.getFoldersByName(FOLDER_NAME);
      const folder = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
      const b64 = String(d.image).split(',')[1];
      const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', d.group + '조_' + t.replace(/[:.]/g, '-') + '.jpg');
      const f = folder.createFile(blob);
      sheet_('사진', ['시각', '조', '이름', '파일', 'id']).appendRow([t, d.group, d.name, f.getUrl(), d.id]);
    } else if (d.type === 'progress' || d.type === 'join' || d.type === 'start') {
      sheet_('진행', ['시각', '조', '종류', '단계', '경과(초)', '이름', 'id']).appendRow([t, d.group, d.type, d.stageName || '', d.elapsedSec == null ? '' : d.elapsedSec, d.name || '', d.id]);
    } else throw new Error('unknown type');
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally { lock.releaseLock(); }
}

// 스태프 현황판용: ?action=progress
function doGet(e) {
  const out = {};
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('진행');
  if (sh) {
    const rows = sh.getDataRange().getValues().slice(1);
    rows.forEach(r => {
      const g = r[1]; if (!g) return;
      const o = out[g] = out[g] || { group: g, done: [], startedAt: '', last: '', elapsed: null };
      if (r[2] === 'start') o.startedAt = r[0];
      if (r[2] === 'progress') { if (o.done.indexOf(r[3]) < 0) o.done.push(r[3]); o.last = r[3]; o.lastAt = r[0]; o.elapsed = r[4]; }
    });
  }
  // 기도문·사진 개수
  [['기도문', 'prayers'], ['사진', 'photos']].forEach(([name, key]) => {
    const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!s) return;
    s.getDataRange().getValues().slice(1).forEach(r => {
      const g = r[1]; if (!g) return;
      const o = out[g] = out[g] || { group: g, done: [], startedAt: '', last: '', elapsed: null };
      o[key] = (o[key] || 0) + 1;
    });
  });
  return json_({ ok: true, groups: out });
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
