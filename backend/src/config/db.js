import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql', // importante para Docker
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '2003',
  database: process.env.DB_NAME || 'petcat_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
