const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
// const SECRET_KEY = process.env.SECRET_KEY;
const userModel = require("../models/UsersDB.js");


 const login = async (req , res)=>{
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
        const token = jwt.sign({ email }, process.env.SECRET_KEY);
    
        // Set token in HTTP-only cookie
        // res.cookie("token", token, { httpOnly: true, sameSite: "strict" });
    
        // console.log("Login successful, Token:", token);
        res.json({ message: "Login successful", token });
      } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Something went wrong" });
      }
}

const signup = async (req, res) => {
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
              const token = jwt.sign({ email }, process.env.SECRET_KEY);
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
}
module.exports = {login , signup};