const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {type: String, required: true, unique: true},
  password: {type: String, required: true, unique: false},
  email: {type: String, required: true, unique: true},
  token: {type: String, required: true, unique: true},
  friendCode: {type: String, unique: true, sparse: true},
  friends: [{ 
            userid: {type: mongoose.Schema.Types.ObjectId, ref:'users'}, 
            canSeeMyCollection: {type: Boolean, required: true, default: true}, 
            canAskForMovies: {type: Boolean, required: true, defaut: true} 
        }],
  movies: [{
            movieid: {type: mongoose.Schema.Types.ObjectId, ref:'movies'},
            ranking: {type: Number, required: false},
            review: {type: String, required: false},
            isLoaned: {type: Boolean, required: true},
            physical_format: [{type: mongoose.Schema.Types.ObjectId, ref:'physical'}],
            pastLoans: [{
              movieid: {type: mongoose.Schema.Types.ObjectId, ref:'movies'},
              isSharedToUser: {type: Boolean, required: true},
              userid: {type: mongoose.Schema.Types.ObjectId, ref:'users'},
              borrower: {type: String, required: false},
              dueDate: {type: Date, required: true},
              notes: {type: String, require: false},
              Notification: {type: Boolean, require: true, default: false}
            }],
            isAsked: [{type: mongoose.Schema.Types.ObjectId, ref:'users'}],
            isLiked: {type: Boolean, required: true}

  }],
  notifications: [{
            type: {
              type: String,
              required: true,
              enum: ['friend_request', 'loan_request', 'loan_reminder', 'loan_accepted', 'loan_refused']
            },
            senderId: {type: mongoose.Schema.Types.ObjectId, ref:'users', required: false},
            movieId: {type: mongoose.Schema.Types.ObjectId, ref:'movies', required: false},
            isRead: {type: Boolean, required: true, default: false}, 
            createdAt: {type: Date, required: true, default: Date.now}
}],
});

const User = mongoose.model('users', userSchema);

module.exports = User;