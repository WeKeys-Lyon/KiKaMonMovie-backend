const mongoose = require('mongoose');

const composersSchema = new mongoose.Schema({
    firstname: {type: String, required: true, unique: false},
    lastname: {type: String, required: true, unique: false},
    yearofbirth: {type: String, required: true, unique: false}
});

const Composers = mongoose.model('composers', composersSchema);

module.exports = Composers;