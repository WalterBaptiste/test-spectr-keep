const SPREADSHEET_ID = '1gRtZ3Y1Ibnu16vQ3uHeXZvF7fISNBoYyDauw6b22Bdc';
const SHEET_NAME = 'Scores';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const sheet = getScoreSheet_();

    sheet.appendRow([
      new Date(),
      clean_(data.name, 80),
      clean_(data.contact, 150),
      number_(data.score),
      number_(data.total),
      number_(data.timeMs),
      number_(data.hints),
      number_(data.penalty),
      clean_(data.userAgent, 250)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getScoreSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Date', 'Nom', 'Contact', 'Score', 'Total',
      'Temps (ms)', 'Indices', 'Pénalité', 'Navigateur'
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function clean_(value, maxLength) {
  const text = String(value || '').trim().slice(0, maxLength);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function number_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
