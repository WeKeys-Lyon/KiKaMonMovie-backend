const mongoose = require('mongoose');

const genresSchema = new mongoose.Schema({
    name: {type: String, required: true, unique: true},
    tmbdb_genre_id: {type: Number, required: true, unique: true}
});

const Genres = mongoose.model('genres', genresSchema);

module.exports = Genres;