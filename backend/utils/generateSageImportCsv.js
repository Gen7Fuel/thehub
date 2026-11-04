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

function generateSageImportCsv({ date, depositAccountName, depositAccountNumber, entries }) {
  const reportDate = formatUsDate(date);
  const rows = entries.map((entry, index) => {
    const values = {
      DONOTIMPORT: "",
      RECEIPT_DATE: reportDate,
      DOCDATE: reportDate,
      DEPOSITTO: depositAccountName,
      UNDEPACCTNO: depositAccountNumber,
      CURRENCY: "CAD",
      LINE_NO: index + 1,
      ACCT_NO: entry.accNo,
      AMOUNT: entry.amount,
      PAYER_NAME: "Daily Sales",
    };
    return SAGE_IMPORT_HEADERS.map((header) => csvValue(values[header])).join(",");
  });

  return Buffer.from(
    [SAGE_IMPORT_HEADERS.join(","), ...rows].join("\r\n") + "\r\n",
    "utf8",
  );
}

module.exports = { SAGE_IMPORT_HEADERS, generateSageImportCsv };
