/**
 * DUAS CMS BACKEND - PRODUCTION READY (V2)
 *
 * 1. Replace the ID below.
 * 2. Deploy: New Deployment > Web App > Execute as: Me > Access: Anyone.
 */
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

function getSS() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
    throw new Error("CONFIG_ERROR: Spreadsheet ID is not set. Please open code.gs and paste your Google Sheet ID into the SPREADSHEET_ID variable.");
  }
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    throw new Error("ID_ERROR: Could not find spreadsheet. Ensure the ID is correct and you have given the script permission to access it.");
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'data') return jsonResponse(getAllData());
    return jsonResponse({ error: 'Invalid action' });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { action, payload, id, type, ids } = data;
    let result;

    switch (action) {
      case 'saveCategory': result = saveRecord('Categories', payload); break;
      case 'deleteCategory': result = deleteRecord('Categories', id); break;
      case 'saveItem': result = saveRecord('Items', payload); break;
      case 'deleteItem': result = deleteRecord('Items', id); break;
      case 'saveMedia': result = saveRecord('MediaLinks', payload); break;
      case 'deleteMedia': result = deleteRecord('MediaLinks', id); break;
      case 'updateOrder': result = updateOrder(type, ids); break;
      default: result = { error: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function getAllData() {
  const ss = getSS();
  return {
    categories: getSheetData(ss, 'Categories'),
    items: getSheetData(ss, 'Items'),
    media: getSheetData(ss, 'MediaLinks')
  };
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const range = sheet.getDataRange();
  if (range.getNumRows() < 2) return []; // Only headers or empty
  const values = range.getValues();
  const headers = values.shift();
  return values.map(row => {
    const obj = {};
    headers.forEach((header, i) => { obj[header] = row[i]; });
    return obj;
  });
}

function saveRecord(sheetName, payload) {
  const ss = getSS();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('SHEET_MISSING: The tab "' + sheetName + '" was not found. Please create a tab named "' + sheetName + '" in your Google Sheet.');
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  if (!headers || headers.length === 0 || headers[0] === "") {
    throw new Error('HEADERS_MISSING: The tab "' + sheetName + '" is empty. Please add headers to the first row.');
  }

  const now = new Date().toISOString();
  payload.updatedAt = now;

  let rowIndex = -1;
  if (payload.id) {
    rowIndex = values.findIndex(row => row[0] == payload.id);
  } else {
    payload.id = Utilities.getUuid();
    payload.createdAt = now;
  }

  const rowData = headers.map(header => payload[header] !== undefined ? payload[header] : '');

  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { success: true, id: payload.id };
}

function deleteRecord(sheetName, id) {
  const ss = getSS();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" missing.');
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.findIndex(row => row[0] == id);
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
    return { success: true };
  }
  return { error: 'Record not found' };
}

function updateOrder(sheetName, ids) {
  const ss = getSS();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" missing.');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const orderColIndex = headers.indexOf('order');
  if (orderColIndex === -1) return { error: 'Order column not found' };

  ids.forEach((id, index) => {
    const rowIndex = values.findIndex(row => row[0] == id);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex + 1, orderColIndex + 1).setValue(index + 1);
    }
  });
  return { success: true };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
