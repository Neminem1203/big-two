const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        maxLength: 8,
        minLength: 2
    },
    password: {
        type: String,
        required: true
    },
    room: {
        type: String,
    }
}, {timestamps: true});

const User = mongoose.model('User', UserSchema);
module.exports = User;