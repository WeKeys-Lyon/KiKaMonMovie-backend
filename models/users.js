const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  username: {type: String, required: true, unique: true},
  password: {type: String, required: true, unique: false},
  email: {type: String, required: true, unique: true},
  token: {type: String, required: true, unique: true},
  friends: [{ 
            userid: {type: mongoose.Schema.Types.ObjectId, ref:'friends'}, 
            canSeeMyCollection: {type: Boolean, required: true}, 
            canAskForMovies: {type: Boolean, required: true} 
        }],
  movies: [{
            movieid: {type: mongoose.Schema.Types.ObjectId, ref:'movies'},
            ranking: {type: Number, required: false},
            review: {type: String, required: false},
            isLoaned: {type: Boolean, required: true},
            physical_format: [{type: mongoose.Schema.Types.ObjectId, ref:'physical'}],
            pastLoans: [{type: mongoose.Schema.Types.ObjectId, ref:'loans'}],
            isAsked: [{type: mongoose.Schema.Types.ObjectId, ref:'users'}]

  }],
});

const User = mongoose.model('users', userSchema);

module.exports = User;