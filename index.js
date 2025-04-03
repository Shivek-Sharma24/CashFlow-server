const express = require("express");
const expenseRoutes = require("./routes/Expense");
const cors = require("cors");
const cookieparser = require("cookie-parser");
const app = express();

const port = 5000;
const bodyParser = require("body-parser");
app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);
app.use(bodyParser.json());
app.use(cookieparser());
app.use("/", expenseRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
