const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  name: {
    type: String,
    require: true,
  },
  amount: {
    type: Number,
    require: true,
  },
  category: {
    type: String,
    enum: ["Food", "Transport", "Bills", "Shopping", "Entertainment", "Other"], // Predefined categories
    default: "Other",
  },
  date: { type: Date, default: Date.now, require: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users", // Reference to the User model
  },
});

module.exports = mongoose.model("Expense", expenseSchema);
