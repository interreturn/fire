const mongoose = require('mongoose');



const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    dob: { type: String, required: true },
    phone: { type: String, required: true }
});

const User = mongoose.model('iosuser', userSchema);

module.exports = User;