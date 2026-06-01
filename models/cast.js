const mongoose = require('mongoose');

const castSchema = new mongoose.Schema({
    name : {type: String, required: true, unique: false},
    tmdb_actor_id: {type: Number, required: true, unique: true},
    popularity: {type: Number, required: false}
});

const Cast = mongoose.model('cast', castSchema);

module.exports = Cast;