/**
 * The Bandits Riders (TBR) — Join form receiver.
 *
 * Deploy this script as a Web App bound to your Google Sheet.
 * Every form submission is appended as a new row.
 *
 * Setup instructions live in README.md.
 */

var SHEET_NAME = "Riders"; // change if you want a different tab name

function doPost(e) {
  try {
    var sheet = getOrCreateSheet_();
    var p = (e && e.parameter) || {};

    var row = [
      new Date(),                 // A: server-received timestamp
      p.name || "",               // B: full name
      p.email || "",              // C: email
      p.mobile || "",             // D: mobile (optional)
      p.membershipType || "",     // E: Permanent / Casual
      p.bike || "",                // F: bike make & model (optional)
      p.experience || "",         // G: riding experience
      p.rideTypes || "",          // H: preferred ride types (comma-separated)
      p.source || "",              // I: how they heard about the club
      p.submittedAt || "",        // J: client-side submitted-at timestamp
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "The Bandits Riders (TBR) join-form endpoint is live." }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Timestamp", "Name", "Email", "Mobile", "Membership Type",
      "Bike", "Experience", "Preferred Ride Types", "Heard About Us", "Submitted At (client)",
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
