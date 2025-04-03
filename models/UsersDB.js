const mongoose = require("mongoose");
require("dotenv").config();
const password = process.env.DB_Password;

mongoose
  .connect(
    `mongodb+srv://shivek_24:${password}@shivek.6yh3v.mongodb.net/Cashflow`,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Database connected");
  })
  .catch((err) => {
    console.log(err);
  });

const userSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Expense" }],
  // expenseID: {
  //     type: mongoose.Schema.Types.ObjectId,
  //     ref: "users", // Reference to the User model
  //     required: true,
  //   },
});

module.exports = mongoose.model("users", userSchema);
