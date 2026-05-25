const mongoose = require('mongoose');

const directorsSchema = new mongoose.Schema({
    name : {type: String, required: true, unique: false},
});

const Directors = mongoose.model('directors', directorsSchema);

module.exports = Directors;