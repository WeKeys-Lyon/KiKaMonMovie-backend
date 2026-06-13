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
            canAskForMovies: {type: Boolean, required: true, default: true}, // (J'ai corrigé une mini coquille sur 'default' ici au passage !)
            canRate: {type: Boolean, required: true, default: true},
            canComment: {type: Boolean, required: true, default: true}
        }],
  pendingRequests: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users'
  }],
  movies: [{
            movieid: {type: mongoose.Schema.Types.ObjectId, ref:'movies', unique: true},
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
            isLiked: {type: Boolean, required: true},
            
            // 🌟 VICTOIRE : On a glissé "reviews" À L'INTÉRIEUR de "movies" !
            reviews: [{
              userid: {type: mongoose.Schema.Types.ObjectId, ref:'users'},
              rating: {type: Number, required: false, min: 0, max: 5},
              comment: {type: String, required: false},
              likes: [{type: mongoose.Schema.Types.ObjectId, ref:'users'}],
              replies: [{
                userid: {type: mongoose.Schema.Types.ObjectId, ref:'users'},
                text: {type: String, required: true},
                createdAt: {type: Date, required: true, default: Date.now}
              }],
              createdAt: {type: Date, required: true, default: Date.now}
            }]

  }], // 👈 On ferme "movies" ICI maintenant !
  
  notifications: [{
            type: {
              type: String,
              required: true,
              enum: ['friend_request', 'friend_accepted', 'friend_refused', 'loan_request', 'loan_reminder', 'loan_accepted', 'loan_refused', 'loan_expired']
            },
            senderId: {type: mongoose.Schema.Types.ObjectId, ref:'users', required: false},
            movieId: {type: mongoose.Schema.Types.ObjectId, ref:'movies', required: false},
            isRead: {type: Boolean, required: true, default: false}, 
            createdAt: {type: Date, required: true, default: Date.now}
  }]
});

const User = mongoose.model('users', userSchema);

module.exports = User;