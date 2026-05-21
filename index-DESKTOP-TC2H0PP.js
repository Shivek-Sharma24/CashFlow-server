const express = require("express");
const expenseRoutes = require("./routes/Expense");
const cors = require("cors");
const cookieparser = require("cookie-parser");

const app = express();
const port = process.env.port;

app.use(
  cors({
    origin: "https://cashflow-client.vercel.app",
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieparser());

app.use("/", expenseRoutes);

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});





