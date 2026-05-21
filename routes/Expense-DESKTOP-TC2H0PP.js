const express = require("express");
const router = express.Router();
const ExpenseDB = require("../models/ExpenseDB");
require("dotenv").config();
// const authMiddleware = require("./authmiddleware");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/UsersDB");
const secretkey = process.env.SECRET_KEY;

router.get("/", (req, res) => {
  res.send("server ruuning ");
});

//user registeration
router.post("/create", async (req, res) => {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    bcrypt.genSalt(10, (err, salt) => {
      if (err) {
        console.error("Salt generation error:", err);
        return res.status(500).json({ error: "Server error" });
      }

      bcrypt.hash(password, salt, async (err, hash) => {
        if (err) {
          console.error("Hashing error:", err);
          return res.status(500).json({ error: "Server error" });
        }

        try {
          let user = await userModel.create({
            username,
            email,
            password: hash,
          });
          const token = jwt.sign({ email }, secretkey);
          // res.cookie("token", token, { httpOnly: true });
          // console.log(token);
          res.status(201).json({
            message: "User registered successfully",
            token,
            userId: user._id,
          });
        } catch (dbError) {
          console.error("Database error:", dbError);
          res.status(500).json({ error: "Database error" });
        }
      });
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

//login route

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ email }, secretkey);

    // Set token in HTTP-only cookie
    // res.cookie("token", token, { httpOnly: true, sameSite: "strict" });

    // console.log("Login successful, Token:", token);
    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Get all expenses
router.get("/getall/expenses", authMiddleware, async (req, res) => {
  const useremail = req.user.email;
  let user = await userModel.findOne({ email: useremail });
  // console.log(user._id);
  let id = user._id;

  // const expenses = await ExpenseDB.find();
  let useexpens = await userModel.findById(id).populate("expenses");
  if (useexpens.expenses.length > 0) {
    res.send(useexpens.expenses);
  } else {
    res.send("Empty expenses");
  }
});

router.get("/username", authMiddleware, async (req, res) => {
  try {
    let email = req.user.email;
    let user = await userModel.findOne({ email: email });
    res.send(user.username);
  } catch (error) {
    res.json({ message: "Error in username fetching" });
    console.log("error in fetching username", error);
  }
});

// Add an expense
router.post("/add/expense", authMiddleware, async (req, res) => {
  try {
    const useremail = req.user.email;

    console.log("middleware", useremail);
    let user = await userModel.findOne({ email: useremail });
    // console.log(user._id);
    let { name, amount, category, date } = req.body;
    const newExpense = await ExpenseDB.create({
      name,
      amount,
      category,
      date,
      userId: user._id,
    });
    await newExpense.save();
    await userModel.findByIdAndUpdate(user._id, {
      $push: { expenses: newExpense._id },
    });

    res.json(newExpense);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

async function authMiddleware(req, res, next) {
  // console.log("Headers Received in Middleware:", req.headers); // Log all headers

  const token = req.header("Authorization")?.split(" ")[1]; // Extract token from header

  // console.log("Received Token:", token); // Log the token

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, secretkey); // Verify JWT
    // console.log("Decoded Token:", decoded); // Log decoded payload

    req.user = decoded; // Attach decoded data to request
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    res.status(401).json({ error: "Invalid token" });
  }
}

router.get("/category/:category", authMiddleware, async (req, res) => {
  try {
    const useremail = req.user.email;
    const user = await userModel.findOne({ email: useremail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const id = user._id;

    // Populate expenses and filter by category
    const userExpenses = await userModel.findById(id).populate("expenses");

    if (!userExpenses || userExpenses.expenses.length === 0) {
      return res.json({ message: "No expenses found" });
    }

    // Filter expenses by category
    const filteredExpenses = userExpenses.expenses.filter(
      (expense) => expense.category === req.params.category
    );

    if (filteredExpenses.length > 0) {
      res.json(filteredExpenses);
    } else {
      res.json({ message: "No expenses found for this category" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete an expense
// router.delete("/delete/:id", async (req, res) => {
//   try {
//     await ExpenseDB.findByIdAndDelete(req.params.id);
//     res.json({ message: "Expense deleted" });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

router.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    const useremail = req.user.email;
    const user = await userModel.findOne({ email: useremail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const id = user._id;
    const expenseId = req.params.id;
    // Find the expense and check if it belongs to the logged-in user
    const expense = await ExpenseDB.findOne({ _id: expenseId, userId: id });

    if (!expense) {
      return res
        .status(404)
        .json({ message: "Expense not found or unauthorized" });
    }

    // Delete the expense
    await ExpenseDB.findByIdAndDelete(expenseId);

    res.json({ message: "Expense deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/expenses/monthly", authMiddleware, async (req, res) => {
  try {
    const useremail = req.user.email;
    const user = await userModel.findOne({ email: useremail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const id = user._id;

    let { month, year } = req.query;

    // Get current year and month if not provided
    const now = new Date();
    if (!year) year = now.getFullYear();
    if (!month) month = (now.getMonth() + 1).toString().padStart(2, "0"); // Ensure "01", "02", etc.

    // Format for MongoDB aggregation
    const targetMonth = `${year}-${month}`;

    const totalExpense = await ExpenseDB.aggregate([
      {
        $match: {
          userId: id,
          date: {
            $gte: new Date(`${targetMonth}-01T00:00:00.000Z`),
            $lt: new Date(`${targetMonth}-31T23:59:59.999Z`),
          },
        },
      },
      {
        $group: {
          _id: targetMonth,
          totalExpense: { $sum: "$amount" },
        },
      },
    ]);

    res.json(
      totalExpense.length > 0
        ? totalExpense[0]
        : { _id: targetMonth, totalExpense: 0 }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

