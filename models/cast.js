const mongoose = require('mongoose');

const castSchema = new mongoose.Schema({
    name : {type: String, required: true, unique: false},
});

const Cast = mongoose.model('cast', castSchema);

module.exports = Cast;