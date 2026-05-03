const ADODB = require('node-adodb');

const dbPath = 'C:\\Users\\a\\Desktop\\QMS-BLUEORION 2026\\BLUEORION_QMS\\BLUEORION SYSTEM_2026-05-02.accdb';

const connection = ADODB.open(
  `Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${dbPath};Persist Security Info=False;`
);

// First, list all tables
connection
  .schema(20) // adSchemaTables = 20
  .then(data => {
    const tables = data
      .filter(t => t.TABLE_TYPE === 'TABLE')
      .map(t => t.TABLE_NAME);

    console.log('=== TABLES IN DATABASE ===');
    tables.forEach(t => console.log(' -', t));
    console.log('');

    // Read first 10 rows from each table
    const queries = tables.map(table =>
      connection
        .query(`SELECT TOP 10 * FROM [${table}]`)
        .then(rows => {
          console.log(`\n=== TABLE: ${table} (${rows.length} rows shown) ===`);
          if (rows.length > 0) {
            console.log('Columns:', Object.keys(rows[0]).join(', '));
            rows.forEach((r, i) => console.log(`Row ${i + 1}:`, JSON.stringify(r)));
          } else {
            console.log('(empty table)');
          }
        })
        .catch(err => console.log(`Error reading ${table}:`, err.message))
    );

    return Promise.all(queries);
  })
  .then(() => console.log('\nDone.'))
  .catch(err => console.error('Connection error:', err.message));
