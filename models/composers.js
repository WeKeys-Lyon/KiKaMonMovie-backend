const mongoose = require('mongoose');

const composersSchema = new mongoose.Schema({
    name : {type: String, required: true, unique: false},
    tmdb_composer_id: {type: Number, required: true, unique: true},
    popularity: {type: Number, required: false}
});

const Composers = mongoose.model('composers', composersSchema);

module.exports = Composers;