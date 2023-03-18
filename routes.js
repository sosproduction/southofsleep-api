require('dotenv').config();
const express = require("express");
const products = require('./products.json');
const stripe = require('stripe')(process.env.STRIPE_API_SECRET);
//const { validateCartItems } = require("use-shopping-cart/src/serverUtil");
const { validateCartItems } = require("use-shopping-cart/utilities");

 // Configure database connection. Move to .env file?
const config = require('./config');
// import uses of promises library for mysql
const mysql = require('mysql2/promise');
// instantiate a pool for mysql
const pool = mysql.createPool(config.db);

 
module.exports = function getRoutes() {
  const router = express.Router();

  // USERS Routes


  // Get all users
  router.get("/users", async (req, res) => {
    try {
      const [rows, fields] = await pool.query(`SELECT * FROM user`);
      res.set({
        "Access-Control-Expose-Headers": "Content-Range",
        "Content-Range": "users 0-24/319"
      });
      res.json(rows);
      
    } catch (err) {
      console.error(err.message);
    }
  });

  // Get an individual user
  router.get("/users/:id", async (req, res) => {
    try {
      const userId = JSON.stringify(req.params);
      console.log("params: " + userId);
      const [rows, fields] = await pool.query("SELECT * FROM user WHERE id = " + id);
      console.log("rows: " + JSON.stringify(rows));
      res.json(rows[0]);
    } catch (err) {
      console.error(err.message);
    }
  });

  // Create a user
  router.post("/users", async (req, res) => {

    const passwordHash = "***salted_password***";
    // Have to munge some to get into the DATETIME format for mySQL
    const registeredAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const { firstName, lastName, email } = req.body;
    // passwordHash and registeredAt require default values. placeholders for now
    try {
      await pool.query(`INSERT INTO user (firstName, lastName, email, passwordHash, registeredAt) VALUES('${firstName}', '${lastName}', '${email}', '${passwordHash}', '${registeredAt}')`);
      res.json({ message: 'User created' });
    } catch (err) {
      console.log(err.message);
    }
  });

  // Update a user
  router.put("/users/:id", async (req, res) => {
    try {
      const id = req.params.id;  // WHERE
      //const { firstName, lastName, email } = req.body // SET
      const updateData = req.body;
      const [rows, fields] = await pool.query(
        "UPDATE user SET ? WHERE id = ?", [updateData, id]);
        res.json(rows);
    } catch (err) {
      console.error(err.message);
    }
  });

  // Delete a user
  router.delete("/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleteUser = await pool.query(`DELETE FROM user WHERE id = "${id}"`);
      res.json(deleteUser);
    } catch (err) {
      console.error(err.message);
    }
  });

  // POST Routes

  // Get all posts
  router.get("/posts", async (req, res) => {
    try {
      const allPosts = await pool.query("SELECT * from public.post ORDER BY id ASC");
      res.set({
        "Access-Control-Expose-Headers": "Content-Range",
        "Content-Range": "users 0-24/319"
      });
      let data = allPosts.rows;
      // Can also just send(allPosts.rows) doesn't seem that var has to be named 'data'
      res.status(200).send(data);
    } catch (err) {
      console.error(err.message);
    }
  });

  // Create a post
  router.post("/posts", async (req, res) => {
    try {
      const { 
        title,
        content
      } = req.body;
      const newPost = await pool.query(
        "INSERT INTO public.post (title, content) VALUES ($1, $2) RETURNING *", [title, content]
      );
      res.json(newPost.rows[0]);
    } catch (err) {
      console.log(err.message);
    }
  });


 

  // Products
  router.get("/products", getProducts);
  router.get("/products/:productId", getProduct);

  // Checkout
  router.post("/checkout-sessions", createCheckoutSession);
  router.get("/checkout-sessions/:sessionId", getCheckoutSession);

  return router;
};



// all of these functions should beomce parts of a controller and abstracted away
function getProducts(req, res) {
  res.status(200).json({ products });
}

function getProduct(req, res) {
  const { productId } = req.params;
  const product = products.find(product => product.id === productId);
  try {
    if (!product) {
      throw Error(`No prouduct found for id: ${productid}`)
    }
    res.status(200).json({ product });
  } catch (error) {
    return res.status(404).json({ statusCode: 404, message: error.message });
  }
}

async function createCheckoutSession(req, res) {
  try {
    const cartItems = req.body;
    const line_items = validateCartItems(products, cartItems);

    const origin = process.env.NODE_ENV === 'production' ? req.headers.origin : 'http://localhost:3000'

    const params = {
      submit_type: "pay",
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      shipping_address_collection: {
        allowed_countries: ["MY", "US", "CA"]
      },
      line_items,
      success_url: `${origin}/result?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: origin,
      mode: 'payment'
    }

    const checkoutSession = await stripe.checkout.sessions.create(params);

    res.status(200).json(checkoutSession)
  } catch (error) {
    res.status(500).json({ statusCode: 500, message: error.message });
  }
}

async function getCheckoutSession(req, res) {
  const { sessionId } = req.params;
  try {
    if (!sessionId.startsWith("cs_")) {
      throw Error("Incorrect checkout session id")
    }
    const checkout_session = await stripe.checkout.sessions.retrieve (
      sessionId,
      { expand: ["payment_intent"]}
    )
    res.status(200).json(checkout_session);
  } catch (error) {
    res.status(500).json({statusCode: 500, message: error.message})
  }
}