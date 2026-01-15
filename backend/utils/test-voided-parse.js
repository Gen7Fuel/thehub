const { parseSftReport } = require('./parseSftReport');

const sample = `
            SHIFT STATISTICS            

Total transactions.................. 827
                              $ 41930.32
Fuel only transactions.............. 347
                              $ 22404.31
Fuel tax - GST                $     0.00
Fuel tax - PST                $     0.00
Voided Transactions................... 3
                              $   218.00
AFD transactions.................... 315
                              $ 20446.68
# of Shift Inquiries run.............. 2
Last Shift Inquiry run at:
13 Jan 26  20:25:06
`;

const result = parseSftReport(sample);
console.log('Parsed metrics:', JSON.stringify(result, null, 2));
console.log('Voided Transactions Amount:', result.voidedTransactionsAmount);
console.log('Voided Transactions Count:', result.voidedTransactionsCount);
