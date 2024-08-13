const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const initializeDatabase = require("./database");

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

initializeDatabase()
  .then((pool) => {
    app.post("/adduser", async (req, res) => {
      const { email, full_name, contact_number, address, password } = req.body;

      if (!email || !full_name || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
          "INSERT INTO users (email, full_name, contact_number, address, password) VALUES ($1, $2, $3, $4, $5) RETURNING *",
          [email, full_name, contact_number, address, hashedPassword]
        );

        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Error adding user:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Login
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
      }

      try {
        const result = await pool.query(
          "SELECT * FROM users WHERE email = $1",
          [email]
        );

        if (result.rows.length === 0) {
          return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return res.status(401).json({ error: "Invalid email or password" });
        }

        res.status(200).json({ message: "Login successful", user });
      } catch (err) {
        console.error("Error during login:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Add service
    app.post("/addservice", async (req, res) => {
      const { title, description, subcategories, userId, userEmail } = req.body;

      if (!title || !description || !userId || !userEmail || !subcategories) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let parsedSubcategories;
      try {
        parsedSubcategories = JSON.parse(subcategories);
      } catch (err) {
        return res.status(400).json({ error: "Invalid subcategories format" });
      }

      if (!Array.isArray(parsedSubcategories)) {
        return res
          .status(400)
          .json({ error: "Subcategories must be an array" });
      }

      try {
        const result = await pool.query(
          "INSERT INTO services (title, description, user_id, user_email) VALUES ($1, $2, $3, $4) RETURNING *",
          [title, description, userId, userEmail]
        );

        const serviceId = result.rows[0].id;

        const subcategoryQueries = parsedSubcategories.map((sub) => {
          return pool.query(
            "INSERT INTO subcategories (service_id, name, price, short_description) VALUES ($1, $2, $3, $4)",
            [serviceId, sub.name, sub.price, sub.shortDescription]
          );
        });

        await Promise.all(subcategoryQueries);

        res.status(201).json({
          message: "Service and subcategories added successfully",
          serviceId,
        });
      } catch (err) {
        console.error("Error adding service and subcategories:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Fetch all services
    app.get("/services", async (req, res) => {
      try {
        const servicesResult = await pool.query("SELECT * FROM services");

        const services = servicesResult.rows;

        // Fetch subcategories for each service
        const subcategoryPromises = services.map(async (service) => {
          const subcategoriesResult = await pool.query(
            "SELECT * FROM subcategories WHERE service_id = $1",
            [service.id]
          );
          return {
            ...service,
            subcategories: subcategoriesResult.rows,
          };
        });

        const servicesWithSubcategories = await Promise.all(
          subcategoryPromises
        );

        res.status(200).json(servicesWithSubcategories);
      } catch (err) {
        console.error("Error fetching services:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Fetch by user id
    app.get("/services/:userId", async (req, res) => {
      const { userId } = req.params;

      try {
        const servicesResult = await pool.query(
          "SELECT * FROM services WHERE user_id = $1",
          [userId]
        );

        const services = servicesResult.rows;

        // Fetch subcategories for each service
        const subcategoryPromises = services.map(async (service) => {
          const subcategoriesResult = await pool.query(
            "SELECT * FROM subcategories WHERE service_id = $1",
            [service.id]
          );
          return {
            ...service,
            subcategories: subcategoriesResult.rows,
          };
        });

        const servicesWithSubcategories = await Promise.all(
          subcategoryPromises
        );

        res.status(200).json(servicesWithSubcategories);
      } catch (err) {
        console.error("Error fetching services by user ID:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Delete a Service and Its Subcategories
    app.delete("/service/:serviceId", async (req, res) => {
      const { serviceId } = req.params;

      try {
        // First, delete subcategories associated with the service
        await pool.query("DELETE FROM subcategories WHERE service_id = $1", [
          serviceId,
        ]);

        // Then, delete the service itself
        await pool.query("DELETE FROM services WHERE id = $1", [serviceId]);

        res.status(200).json({
          message: "Service and associated subcategories deleted successfully",
        });
      } catch (err) {
        console.error("Error deleting service:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Edit a Service and Its Subcategories
    app.put("/service/:serviceId", async (req, res) => {
      const { serviceId } = req.params;
      const { title, description, subcategories } = req.body;

      if (!title || !description || !subcategories) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let parsedSubcategories;
      try {
        parsedSubcategories = JSON.parse(subcategories);
      } catch (err) {
        return res.status(400).json({ error: "Invalid subcategories format" });
      }

      if (!Array.isArray(parsedSubcategories)) {
        return res
          .status(400)
          .json({ error: "Subcategories must be an array" });
      }

      try {
        // Update the service
        await pool.query(
          "UPDATE services SET title = $1, description = $2 WHERE id = $3",
          [title, description, serviceId]
        );

        // Delete existing subcategories for the service
        await pool.query("DELETE FROM subcategories WHERE service_id = $1", [
          serviceId,
        ]);

        // Insert new subcategories
        const subcategoryQueries = parsedSubcategories.map((sub) => {
          return pool.query(
            "INSERT INTO subcategories (service_id, name, price, short_description) VALUES ($1, $2, $3, $4)",
            [serviceId, sub.name, sub.price, sub.shortDescription]
          );
        });

        await Promise.all(subcategoryQueries);

        res.status(200).json({
          message: "Service and subcategories updated successfully",
        });
      } catch (err) {
        console.error("Error updating service and subcategories:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Add booking
    app.post("/addbooking", async (req, res) => {
      const { serviceId, subcategoryName, userId } = req.body;

      if (!serviceId || !subcategoryName || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      try {
        const result = await pool.query(
          "INSERT INTO bookings (service_id, subcategory_name, user_id) VALUES ($1, $2, $3) RETURNING *",
          [serviceId, subcategoryName, userId]
        );

        res.status(201).json({
          message: "Booking added successfully",
          booking: result.rows[0],
        });
      } catch (err) {
        console.error("Error adding booking:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Add a request
    app.post("/addrequest", async (req, res) => {
      const { name, email, phone, message, userId } = req.body;

      if (!name || !email || !phone || !message || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      try {
        const result = await pool.query(
          "INSERT INTO requests (name, email, phone, message, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
          [name, email, phone, message, userId]
        );

        res.status(201).json({
          message: "Request added successfully",
          request: result.rows[0],
        });
      } catch (err) {
        console.error("Error adding request:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
  });
