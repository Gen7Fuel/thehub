require('dotenv').config();

const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DB,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true }
};

// Function to get sales data from CSO.Sales table
async function getSalesData(csoCode, startDate, endDate) {
  try {
    await sql.connect(sqlConfig);
    const result = await sql.query(`SELECT [Date], SUM([Total Sales]) as [Total Sales]
                                    FROM CSO.Sales
                                    WHERE Station_Code=${csoCode}
                                    AND [Date] BETWEEN '${startDate}' AND '${endDate}'
                                    GROUP BY [Date]
                                    ORDER BY [Date]`);
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

module.exports = { sqlConfig, getSalesData };