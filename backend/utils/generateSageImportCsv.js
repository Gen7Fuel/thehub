const SAGE_IMPORT_HEADERS = [
  "DONOTIMPORT",
  "RECEIPT_DATE",
  "PAYMETHOD",
  "DOCDATE",
  "DOCNUMBER",
  "DESCRIPTION",
  "DEPOSITTO",
  "BANKACCOUNTID",
  "DEPOSITDATE",
  "UNDEPACCTNO",
  "CURRENCY",
  "EXCH_RATE_DATE",
  "EXCH_RATE_TYPE_ID",
  "EXCH_RATE_DATE",
  "LINE_NO",
  "ACCT_NO",
  "ACCOUNTLABEL",
  "TRX_AMOUNT",
  "AMOUNT",
  "DEPT_ID",
  "LOCATION_ID",
  "ITEM_MEMO",
  "OTHERRECEIPTSENTRY_PROJECTID",
  "OTHERRECEIPTSENTRY_CUSTOMERID",
  "OTHERRECEIPTSENTRY_ITEMID",
  "OTHERRECEIPTSENTRY_VENDORID",
  "OTHERRECEIPTSENTRY_EMPLOYEEID",
  "OTHERRECEIPTSENTRY_CLASSID",
  "PAYER_NAME",
  "SUPDOCID",
  "EXCHANGE_RATE",
  "TAXSOLUTIONID",
  "INCLUSIVETAX",
  "TOTALTRXAMOUNT",
  "TAX_LINE_NO",
  "TAX_AMOUNT",
  "TAX_DETAILID",
];

const csvValue = (value) => {
  if (value === undefined || value === null) return "";
  const stringValue = String(value);
  return /[",\r\n]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
};

const formatUsDate = (dateString) => {
  const [year, month, day] = dateString.split("-");
  return `${month}/${day}/${year}`;
};

const formatAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
};

function generateSageImportCsvData({ date, depositAccountName, depositAccountNumber, entries }) {
  const reportDate = formatUsDate(date);
  const rows = entries.map((entry, index) => {
    const values = {
      DONOTIMPORT: "",
      RECEIPT_DATE: reportDate,
      PAYMETHOD: "EFT",
      DOCDATE: reportDate,
      DEPOSITTO: depositAccountName,
      UNDEPACCTNO: depositAccountNumber,
      CURRENCY: "CAD",
      LINE_NO: index + 1,
      ACCT_NO: entry.accNo,
      AMOUNT: formatAmount(entry.amount),
      PAYER_NAME: "Daily Sales",
    };
    return SAGE_IMPORT_HEADERS.map((header) => csvValue(values[header]));
  });

  const csv = [SAGE_IMPORT_HEADERS, ...rows]
    .map((row) => row.join(","))
    .join("\r\n") + "\r\n";

  return {
    headers: SAGE_IMPORT_HEADERS,
    rows,
    csv,
    buffer: Buffer.from(csv, "utf8"),
  };
}

function generateSageImportCsv(input) {
  return generateSageImportCsvData(input).buffer;
}

module.exports = { SAGE_IMPORT_HEADERS, generateSageImportCsv, generateSageImportCsvData };
