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
        firstname: {type: String, required: true, unique: false},
        lastname: {type: String, required: true, unique: false},
        yearofbirth: {type: String, required: true, unique: false}
    }],
    Cast: [{
        actorid: {type: mongoose.Schema.Types.ObjectId, ref:'actors'},
        firstname: {type: String, required: true, unique: false},
        lastname: {type: String, required: true, unique: false},
        yearofbirth: {type: String, required: true, unique: false}
    }],
    Genres: [{
        genreid: {type: mongoose.Schema.Types.ObjectId, ref:'genres'},
        name: {type: String, required: true, unique: false}
    }],
    MusicBy: [{
        composerid: {type: mongoose.Schema.Types.ObjectId, ref:'composers'},
        firstname: {type: String, required: true, unique: false},
        lastname: {type: String, required: true, unique: false},
        yearofbirth: {type: String, required: true, unique: false}
    }],
    })
const Movie = mongoose.model('movies', movieSchema);

module.exports = Movie;
