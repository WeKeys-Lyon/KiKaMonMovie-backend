const mongoose = require('mongoose');

const castSchema = new mongoose.Schema({
    firstname: {type: String, required: true, unique: false},
    lastname: {type: String, required: true, unique: false},
    yearofbirth: {type: String, required: true, unique: false}
});

const Cast = mongoose.model('cast', castSchema);

module.exports = Cast;