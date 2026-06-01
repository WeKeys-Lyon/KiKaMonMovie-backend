const mongoose = require('mongoose');

const genresSchema = new mongoose.Schema({
    name: {type: String, required: true, unique: true},
    tmdb_genre_id: {type: Number, required: true, unique: true}
});

const Genre = mongoose.model('genres', genresSchema);

module.exports = Genre;