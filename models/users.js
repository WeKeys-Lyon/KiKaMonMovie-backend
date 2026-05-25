const mongoose = require('mongoose');

const usersSchema = new mongoose.Schema({
  username: {type: String, required: true, unique: true},
  password: {type: String, required: true, unique: false},
  email: {type: String, required: true, unique: true},
  token: {type: String, required: true, unique: true},
  friends: [{ 
            userid: {type: mongoose.Schema.Types.ObjectId, ref:'users'}, 
            canSeeMyCollection: {type: Boolean, required: true}, 
            canAskForMovies: {type: Boolean, required: true} 
        }],
  movies: [{
            movieid: {type: mongoose.Schema.Types.ObjectId, ref:'movies'},
            ranking: {type: Number, required: false},
            review: {type: String, required: false},
            isLoaned: {type: Boolean, required: true},
            physical_format: [{type: mongoose.Schema.Types.ObjectId, ref:'physical'}],
            pastLoans: [{
              movieid: {type: mongoose.Schema.Types.ObjectId, ref:'movies'},
              isSharedToUser: {type: String, required: true},
              userid: {type: mongoose.Schema.Types.ObjectId, ref:'users'},
              borrower: {type: String, required: false}
            }],
            isAsked: [{type: mongoose.Schema.Types.ObjectId, ref:'users'}]

  }],
});

const Users = mongoose.model('users', usersSchema);

module.exports = Users;