const mongoose = require('mongoose');

const directorsSchema = new mongoose.Schema({
    name : {type: String, required: true, unique: false},
    tmbdb_director_id: {type: Number, required: true, unique: true}
});

const Directors = mongoose.model('directors', directorsSchema);

module.exports = Directors;