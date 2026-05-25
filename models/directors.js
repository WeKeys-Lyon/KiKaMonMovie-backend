const mongoose = require('mongoose');

const directorsSchema = new mongoose.Schema({
    firstname: {type: String, required: true, unique: false},
    lastname: {type: String, required: true, unique: false},
    yearofbirth: {type: String, required: true, unique: false}
});

const Directors = mongoose.model('directors', directorsSchema);

module.exports = Directors;