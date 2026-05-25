const mongoose = require('mongoose');

const composersSchema = new mongoose.Schema({
    name : {type: String, required: true, unique: false},
});

const Composers = mongoose.model('composers', composersSchema);

module.exports = Composers;