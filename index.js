const express = require("express");
const expenseRoutes = require("./routes/Expense");
const cors = require("cors");
const cookieparser = require("cookie-parser");
const app = express();
const port = process.env.port || 5200;
const authRouter = require("./routes/authRoute.js");
const bodyParser = require("body-parser");
app.use(
  cors({
    origin:"http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieparser());
app.use("/auth", authRouter);
app.use("/", expenseRoutes);

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});

app.get("/test" , (req , res)=>{
  res.send("working")
})


