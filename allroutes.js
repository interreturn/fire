const express = require("express");
const router = express.Router();
const iosuser = require("./schema.js"); // Importing the Mongoose model

// POST route to add user info
router.post('/adduserinfo', async (req, res) => {
    try {
        const { name, dob, phone } = req.body;

        // Ensure all required fields are provided
        if (!name || !dob || !phone) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Create and save the user
        const user = new iosuser({ name, dob, phone });
        const savedUser = await user.save();
        
        res.status(201).json(savedUser); // Send back the saved user info
    } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


router.get('/getusers', async (req, res) => {
    try {
        const users = await iosuser.find();
        res.status(200).json(users);
    } catch (error) {
        console.error("Error getting users:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
})

module.exports = router;
