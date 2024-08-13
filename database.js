const { Pool, Client } = require("pg");

const client = new Client({
  user: "postgres",
  password: "Gyver",
  host: "localhost",
  port: 5432,
});

const createDatabase = async () => {
  try {
    await client.connect();
    await client.query("CREATE DATABASE weeding_planner");
    console.log("Database created successfully");
  } catch (err) {
    if (err.code === "42P04") {
      console.log("Database already exists");
    } else {
      console.error("Error creating database:", err);
    }
  } finally {
    await client.end();
  }
};

const createTables = async (pool) => {
  try {
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        contact_number VARCHAR(20),
        address TEXT,
        password TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'client'
      );
    `;
    await pool.query(createUsersTableQuery);
    console.log("Users table created or already exists");

    // Create the 'services' table
    const createServicesTableQuery = `
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createServicesTableQuery);
    console.log("Services table created or already exists");

    // Create the 'subcategories' table
    const createSubcategoriesTableQuery = `
      CREATE TABLE IF NOT EXISTS subcategories (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        short_description TEXT NOT NULL
      );
    `;
    await pool.query(createSubcategoriesTableQuery);
    console.log("Subcategories table created or already exists");

    // Create the 'bookings' table
    const createBookingsTableQuery = `
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
        subcategory_name VARCHAR(255) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createBookingsTableQuery);
    console.log("Bookings table created or already exists");

    // Create the 'requests' table
    const createRequestsTableQuery = `
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createRequestsTableQuery);
    console.log("Requests table created or already exists");
  } catch (err) {
    console.error("Error creating tables:", err);
  }
};

const initializeDatabase = async () => {
  await createDatabase();

  const pool = new Pool({
    user: "postgres",
    password: "Gyver",
    host: "localhost",
    port: 5432,
    database: "weeding_planner",
  });

  await createTables(pool);
  return pool;
};

module.exports = initializeDatabase;
