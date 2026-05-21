const express = require("express");
const router = express.Router();
const ExpenseDB = require("../models/ExpenseDB");
require("dotenv").config();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/UsersDB");
const secretkey = process.env.SECRET_KEY;

router.get("/", (req, res) => {
  res.send("server ruuning ");
});



// Get all expenses 
router.get("/expenses", authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const user = await userModel.findOne({ email: userEmail });
 
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
 
    // ── Parse query params ──────────────────────────────────────────────────
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 5);
    const skip  = (page - 1) * limit;
 
    const now          = new Date();
    const requestedMonth = req.query.month
      ? req.query.month.toLowerCase()
      : now.toLocaleString("default", { month: "long" }).toLowerCase();
    const requestedYear  = parseInt(req.query.year) || now.getFullYear();
 
    // ── Build date range for the requested month ────────────────────────────
    const monthIndex = new Date(`${requestedMonth} 1, ${requestedYear}`).getMonth();
 
    if (isNaN(monthIndex)) {
      return res.status(400).json({ message: "Invalid month provided" });
    }
 
    const startDate = new Date(requestedYear, monthIndex, 1);           // e.g. May 1
    const endDate   = new Date(requestedYear, monthIndex + 1, 0, 23, 59, 59); // e.g. May 31
 
    // ── Fetch paginated expenses for that month ─────────────────────────────
    // Assumes your Expense model has a `date` field and `user` or `userId` field
    // Adjust field names to match your actual schema
 
    const [expenses, totalCount] = await Promise.all([
      ExpenseDB.find({
        userId: user._id,
        date: { $gte: startDate, $lte: endDate },
      })
        .sort({ date: -1 })   // newest first
        .skip(skip)
        .limit(limit),
 
      ExpenseDB.countDocuments({
        userId: user._id,
        date: { $gte: startDate, $lte: endDate },
      }),
    ]);
 
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore    = page < totalPages;
 
    // ── Send response ───────────────────────────────────────────────────────
    return res.status(200).json({
      expenses,
      totalCount,
      currentPage: page,
      totalPages,
      hasMore,
    });
 
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


// POST /add/expense
router.post("/add/expense", authMiddleware, async (req, res) => {
  try {
    const { name, amount, category, date, time } = req.body

    // ── Validate required fields ──────────────────────────────────────────
    if (!name || !amount || !time) {
      return res.status(400).json({ message: "Name, amount and time are required" })
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" })
    }

    // ── Get user from authMiddleware ──────────────────────────────────────
    const userEmail = req.user.email
    const user = await userModel.findOne({ email: userEmail })
    
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // ── Create and save expense ───────────────────────────────────────────
    const newExpense = await ExpenseDB.create({
      name:     name.trim(),
      amount:   Number(amount),
      category: category || "Other",
      date:     date ? new Date(date) : new Date(),
      time,
      userId:   user._id,
    })

    // ── Push expense reference into user's expenses array ─────────────────
    await userModel.findByIdAndUpdate(
      user._id,
      { $push: { expenses: newExpense._id } }
    )

    return res.status(201).json({
      message: "Expense added successfully",
      expense: newExpense,
    })

  } catch (error) {
    console.error("Error adding expense:", error)
    return res.status(500).json({ message: "Internal server error" })
  }
})


// Add an expense
router.get("/expenses/monthly", authMiddleware, async (req, res) => {
  try {
    const useremail = req.user.email;
    const user = await userModel.findOne({ email: useremail });
    if (!user) return res.status(404).json({ message: "User not found" });

    let { month, year } = req.query;
    const now = new Date();
    if (!year)  year  = now.getFullYear()
    if (!month) month = (now.getMonth() + 1).toString().padStart(2, "0")

    const targetMonth = `${year}-${month}`
    const startDate   = new Date(`${targetMonth}-01T00:00:00.000Z`)
    const endDate     = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)

    const result = await ExpenseDB.aggregate([
      {
        $match: {
          userId: user._id,
          date: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: targetMonth,
          totalAmount:      { $sum: "$amount" },       //  total spent
          totalTransaction: { $count: {} },            //  how many expenses
          highestExpense:   { $max: "$amount" },       //  highest single expense
        },
      },
    ])

    res.json(
      result.length > 0
        ? result[0]
        : { _id: targetMonth, totalAmount: 0, totalTransaction: 0, highestExpense: 0 }
    )

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// get weekly data
router.get("/expenses/weekly", authMiddleware, async (req, res) => {
  try {
    const useremail = req.user.email;
    const user = await userModel.findOne({ email: useremail });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Get start (Mon) and end (Sun) of current week
    const now = new Date();
    const dayOfWeek = now.getDay();                          // 0 = Sun, 1 = Mon ...
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // adjust to Monday

    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() + diffToMon)
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)

    const result = await ExpenseDB.aggregate([
      {
        $match: {
          userId: user._id,
          date: { $gte: startOfWeek, $lt: endOfWeek },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$date" },   // 1=Sun, 2=Mon ... 7=Sat
          amount: { $sum: "$amount" },
        },
      },
    ])

    // Map to Mon-Sun format
    const dayMap = {
      2: "Mon", 3: "Tue", 4: "Wed",
      5: "Thu", 6: "Fri", 7: "Sat", 1: "Sun"
    };

    let days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    // Fill missing days with 0
    const chartData = days.map((day) => {
      const found = result.find((r) => dayMap[r._id] === day)
      return { day, amount: found ? found.amount : 0 }
    })

    res.json(chartData)

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// for pie chart :-
router.get("/expenses/category", authMiddleware, async (req, res) => {
  try {
    const useremail = req.user.email;
    const user = await userModel.findOne({ email: useremail });
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const year  = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, "0")

    const startDate = new Date(`${year}-${month}-01T00:00:00.000Z`)
    const endDate   = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)

    const result = await ExpenseDB.aggregate([
      {
        $match: {
          userId: user._id,
          date: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: "$category",
          value: { $sum: "$amount" },
        },
      },
    ])

    // Map colors to each category
    const colorMap = {
      Food:          "#7B61FF",
      Entertainment: "#F55A8A",
      Travel:        "#E5B15B",
      Shopping:      "#49D193",
      Other:         "#60A5FA",
    }

    const chartData = result.map((item) => ({
      category: item._id,
      value:    item.value,
      color:    colorMap[item._id] || "#60A5FA",   // fallback color
    }))

    res.json(chartData)

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

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
    // console.log(decoded)
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


<<<<<<< HEAD
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

=======
module.exports = router;
>>>>>>> 4471984 (Update Backend)
