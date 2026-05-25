const mongoose = require('mongoose');

const movieSchema = mongoose.Schema({
    movieid: {type: String, required: true, unique: true},
    tmbd_id: {type: String, required: true, unique: true},
    title_original: {type: String, required: true, unique: false},
    title_fr: {type: String, required: false, unique: false},
    release_date: {type: Date, required: true, unique: false},
    poster_path: {type: String, required: true, unique: false},
    DirectedBy: [{
        directorid: {type: mongoose.Schema.Types.ObjectId, ref:'directors'},
    }],
    Cast: [{
        actorid: {type: mongoose.Schema.Types.ObjectId, ref:'actors'},
    }],
    Genres: [{
        genreid: {type: mongoose.Schema.Types.ObjectId, ref:'genres'},
    }],
    MusicBy: [{
        composerid: {type: mongoose.Schema.Types.ObjectId, ref:'composers'},
    }],
    })
const Movie = mongoose.model('movies', movieSchema);

module.exports = Movie;
