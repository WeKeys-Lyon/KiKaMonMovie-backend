var express = require('express');
var router = express.Router();
require('../models/connection');
const User = require('../models/users');
const Physical_format = require('../models/physical');
const Movie = require('../models/movies');
const Cast = require('../models/cast');
const Director = require('../models/directors');
const Genre = require('../models/genres');
const Composer = require('../models/composers');
const bcrypt = require('bcrypt');
const uid2 = require('uid2');
const { checkBody, checkUsername, checkEmail, checkPassword} = require('../modules/checkBody');
const {getMovieTreated} = require('../modules/makeACard');
const mongoose = require('mongoose');


// inscription d'un nouvel utilisateur
router.post('/signup', async (req, res) => {
   if (!checkBody(req.body, ['username', 'password', 'email'])) {
    res.status(400).send({result: false, answer : 'Missing parameters'});
    return;
  }
  if (!checkEmail(req.body.email)) {
    res.status(400).send({result: false, answer : 'Invalid email'});
    return;
  }
    const userExists = await User.findOne({username: req.body.username});
    if (userExists) {
        res.status(400).send({result: false, answer : 'User already exists'});
        return;
    }
    const passwordHash = bcrypt.hashSync(req.body.password, 10);
    const token = uid2(32);
    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newUser = new User({
        username: req.body.username,
        password: passwordHash,
        email: req.body.email,
        token: token,
        friendCode: generatedCode
    });
    await newUser.save();
    res.status(201).send({result: true, answer : {username: newUser.username, email: newUser.email, token: newUser.token, movies: newUser.movies, friendCode: newUser.friendCode || []}});
}),

router.post('/signin', async (req, res) => {
    try {
        // 1. Vérification des champs
        if (!checkBody(req.body, ['mylogin', 'password'])) {
            return res.status(400).send({result: false, answer : 'Missing parameters'});
        }

        // 2. Recherche de l'utilisateur 
        const userExists = await User.findOne({
            $or: [{ username: req.body.mylogin }, { email: req.body.mylogin }]
        });

        // Sécurité : Si l'utilisateur n'existe pas du tout
        if (!userExists) {
            return res.status(400).send({result: false, answer : 'User not found or wrong password'});
        }

        // 3. Vérification du mot de passe
        if ( !bcrypt.compareSync(req.body.password, userExists.password) ) {
            return res.status(400).send({result: false, answer : 'User not found or wrong password'});
        } else {

      async function getLocalMovies(userData) {
        //  4.1 Fonction qui prends les movieid de l'utilisateur, puis va sortir les résultats bien formatés
        if (userData.movies) {

          const myResults = await Promise.all( userData.movies.map(async movie => {
            /* let myMovies = {id: movie.movieid.tmdb_id} */
            
            return await getMovieTreated(movie)
            }) )
          
          return myResults;
              }
            }
          // 4.2 On prépare les données depuis userExists et on lance la fonction de formattage
        const userData = await userExists.populate({ path: 'movies.movieid', model: Movie});
        const userMovies = await getLocalMovies(userData);
        // 5. Sortie pour le reducer
        res.status(200).send({result: true, answer: { username: userExists.username, email: userExists.email, token: userExists.token, movies:  userMovies }})
    };

    } catch (error) {
        console.error("Erreur dans signin :", error);
        res.status(500).send({result: false, answer: 'Internal server error'});
    }
});

// Ajouter un film
router.post('/add-movie', async (req, res) => {
  try {     
    const { token, movie } = req.body;

    // 1. Trouver l'utilisateur
    const user = await User.findOne({ token: token });
    if (!user) {
      return res.json({ result: false, error: 'Utilisateur introuvable' });
    }

    // 2. Vérifier si le film existe déjà dans la BDD Globale
    let existingMovie = await Movie.findOne({ tmdb_id: movie.tmdb_id });

    // 3. SI LE FILM N'EXISTE PAS : On peuple les collections avec upsert
    if (!existingMovie) {
      
      // -- GESTION DES RÉALISATEURS --
      const directorsIds = [];
      for (const directorData of (movie.DirectedBy || [])) {
        const director = await Director.findOneAndUpdate(
          { tmdb_director_id: directorData.tmdb_director_id }, // Recherche
          { name: directorData.name, popularity: directorData.popularity }, // Mise à jour
          { returnDocument: 'after', upsert: true } // Création si inexistant
        );
        directorsIds.push({ directorid: director._id });
      }

      // -- GESTION DU CASTING --
      const actorsIds = [];
      for (const actorData of (movie.Cast || [])) {
        const castMember = await Cast.findOneAndUpdate(
          { tmdb_actor_id: actorData.tmdb_actor_id },
          { name: actorData.name, popularity: actorData.popularity },
          { returnDocument: 'after', upsert: true }
        );
        actorsIds.push({ actorid: castMember._id }); 
      }

      // -- GESTION DES GENRES --
      const genresIds = [];
      for (const genreData of (movie.Genres || [])) { 
        const genre = await Genre.findOneAndUpdate(
          { tmdb_genre_id: genreData.tmdb_genre_id },
          { name: genreData.name }, // Les genres n'ont généralement pas de popularité
          { returnDocument: 'after', upsert: true }
        );
        genresIds.push({ genreid: genre._id });
      }

      // -- GESTION DES COMPOSITEURS --
      const composersIds = [];
      for (const composerData of (movie.MusicBy || [])) {
        const composer = await Composer.findOneAndUpdate(
          { tmdb_composer_id: composerData.tmdb_composer_id },
          { name: composerData.name, popularity: composerData.popularity },
          { returnDocument: 'after', upsert: true }
        );
        composersIds.push({ composerid: composer._id });
      }

      // -- CRÉATION DU FILM EN BDD --
      const newMovie = new Movie({
        tmdb_id: movie.tmdb_id,
        original_title: movie.original_title,
        title_fr: movie.title_fr,
        release_date: movie.release_date,
        poster_path: movie.poster_path,
        DirectedBy: directorsIds,
        Cast: actorsIds,
        Genres: genresIds,
        MusicBy: composersIds,
        popularity: movie.popularity
      });

      existingMovie = await newMovie.save();
    }

    // 4. Vérifier si le film est DÉJÀ dans la collection de L'UTILISATEUR
    const isAlreadyInCollection = user.movies.some(
      (m) => m.movieid && m.movieid.toString() === existingMovie._id.toString()
    );

    if (isAlreadyInCollection) {
      return res.json({ result: false, error: 'Ce film est déjà dans votre collection' });
    }

    // 5. Ajouter le film à l'utilisateur
    user.movies.push({
      movieid: existingMovie._id,
      isLoaned: false,
      isLiked: false 
    });
    await user.save();

    res.json({ result: true, message: 'Film ajouté avec succès !' });

  } catch (error) {
    console.error("Erreur critique :", error);
    res.json({ result: false, error: 'Erreur interne du serveur' });
  } 
});

//supprimer un film
router.delete('/delete-movie/', async (req, res) => {
  try {
    if (!checkBody(req.body, ['token', 'tmdb_id'])) {
    res.status(400).send({result: false, answer : 'Missing parameters'});
    return;
  }

    const user = await User.findOne({ token: req.body.token }).populate('movies.movieid');
    
    if (!user) {
      return res.json({ result: false, error: 'Utilisateur non trouvé' });
    }

    const targetMovie = user.movies.filter(m => m.movieid.tmdb_id === req.body.tmdb_id);

    if (!targetMovie) {
      console.log("❌ Le film n'est même pas dans la collection de cet utilisateur !");
      return res.json({ result: false, error: "Ce film n'est pas dans votre collection" });
    }
    const userUpdate = await User.findOneAndUpdate(
      { token: req.body.token },
      { $pull: { movies: { movieid: targetMovie[0].movieid._id } } }, 
      { returnDocument: 'after' } 
    );

    console.log(`✅ VICTOIRE ! Il reste maintenant ${userUpdate.movies.length} films dans la collection.`);
    res.json({ result: true, message: 'Film supprimé avec succès !' });
    
  } catch (error) {
    console.error("Erreur critique :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});

router.post('/add-loan', async (req, res) => {
    try {
      //on obtient l'Object_ID du film
      const myID = await Movie.findOne({tmdb_id: req.body.tmdb_id}).select('_id');

      //on créé le nouveau document de pastLoans
      const newLoan = {
          movieid: await myID._id,
          isSharedToUser: req.body.isSharedToUser,
          userid: (req.body.userid) ? req.body.userid : null,
          borrower: (req.body.isSharedToUser) ? '' :(req.body.borrower),
          dueDate: req.body.dueDate,
          notes: (req.body.notes) ? req.body.notes : null,
          Notification: (req.body.Notification) ? true : false
        };

      //On créé une variable de l'utilisateur
      const user = await User.findOne({token: req.body.token});
      if (user) {
        //On va chercher dans quel index de movies se trouve le film séléctionné
        const movieIndex = user.movies.findIndex(movie => movie.movieid.toString() == myID._id);

        if (movieIndex !== -1) {
          //On ajoute notre document newLoan dans pastLoans
          user.movies[movieIndex].pastLoans.push(newLoan);
          user.movies[movieIndex].isLoaned = true;
          await user.save();

          res.status(200).send({result: true, answer: user.movies[movieIndex].pastLoans })
        } else {
          res.status(200).send({result: false, error: 'Film introuvable' });
        }
      } else {
        res.status(200).send({result: false, error: 'Utilisateur introuvable' })
      }
      
      
  } catch (error) {
    console.error("Erreur critique :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});

router.post('/remove-loan', async (req,res) => {
  try { 
    if (!checkBody(req.body, ['token', 'tmdb_id'])) {
      res.status(400).send({result: false, answer : 'Missing parameters'});
      return;
    }

    //on obtient l'Object_ID du film
    const myID = await Movie.findOne({tmdb_id: req.body.tmdb_id}).select('_id');

    //On créé une variable de l'utilisateur
    const user = await User.findOne({token: req.body.token});

    if (user) {
      //On va chercher dans quel index de movies se trouve le film séléctionné
      const movieIndex = user.movies.findIndex(movie => movie.movieid.toString() == myID._id);
      console.log(movieIndex)
      if (movieIndex !== -1) {  
        user.movies[movieIndex].isLoaned = false;
        await user.save().then(data => res.status(200).send({result: true, answer: user.movies[movieIndex]}));

        
      } else {
        res.status(200).send({result: false, error: 'Film introuvable' });
      }  
    } else {
      res.status(200).send({result: false, error: 'Utilisateur introuvable' })
    }
  } catch (error) {
    console.error("Erreur critique :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }

})
// ROUTE : Mettre à jour le profil (Username, Email ou Mot de passe)
router.put('/update-profile', async (req, res) => {
  try {
    const { token, newUsername, newEmail, newPassword } = req.body;

    if (!token) {
      return res.json({ result: false, error: 'Token manquant' });
    }

    const user = await User.findOne({ token: token });
    if (!user) {
      return res.json({ result: false, error: 'Utilisateur introuvable' });
    }

    let updates = {};
    if (newUsername) updates.username = newUsername;
    if (newEmail) updates.email = newEmail;
    
    // Si l'utilisateur veut changer son mot de passe, on le crypte d'abord !
    if (newPassword) {
      const hash = bcrypt.hashSync(newPassword, 10); // 10 est le "salt" standard
      updates.password = hash;
    }

    // On applique les modifications
    await User.updateOne({ token: token }, { $set: updates });

    res.json({ result: true, message: 'Profil mis à jour avec succès' });

  } catch (error) {
    console.error("Erreur update profil:", error);
    res.json({ result: false, error: 'Erreur serveur' });
  }
});

// ROUTE : Supprimer le compte définitivement
router.delete('/delete-account', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.json({ result: false, error: 'Token manquant' });
    }

    const deletedUser = await User.deleteOne({ token: token });

    if (deletedUser.deletedCount > 0) {
      res.json({ result: true, message: 'Compte supprimé avec succès' });
    } else {
      res.json({ result: false, error: 'Utilisateur introuvable ou déjà supprimé' });
    }

  } catch (error) {
    console.error("Erreur suppression compte:", error);
    res.json({ result: false, error: 'Erreur serveur' });
  }
});
// ROUTE : Récupérer son code ami et sa liste d'amis
router.post('/my-social-data', async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findOne({ token: token }).populate('friends.userid', 'username friendCode');
    if (!user) return res.json({ result: false, error: 'Utilisateur introuvable' });

    res.json({ 
      result: true, 
      friendCode: user.friendCode,
      friends: user.friends
    });

  } catch (error) {
    console.error("Erreur récupération social:", error);
    res.json({ result: false, error: 'Erreur serveur' });
  }
});
// ROUTE : Ajouter un ami via son Friend Code
router.post('/add-friend', async (req, res) => {
  try {
    const { token, friendCodeToAdd } = req.body;

    const user = await User.findOne({ token: token });
    if (!user) return res.json({ result: false, error: 'Utilisateur non trouvé' });

    if (user.friendCode === friendCodeToAdd.toUpperCase()) {
      return res.json({ result: false, error: 'Vous ne pouvez pas vous ajouter vous-même !' });
    }

    const friend = await User.findOne({ friendCode: friendCodeToAdd.toUpperCase() });
    if (!friend) return res.json({ result: false, error: 'Code ami invalide' });

    // On vérifie s'ils sont déjà amis en cherchant dans les objets du tableau
    const alreadyFriends = user.friends.some(f => f.userid.toString() === friend._id.toString());
    if (alreadyFriends) {
      return res.json({ result: false, error: 'Vous êtes déjà amis avec cet utilisateur.' });
    }

    const friendObjForUser = { userid: friend._id, canSeeMyCollection: true, canAskForMovies: true };
    const userObjForFriend = { userid: user._id, canSeeMyCollection: true, canAskForMovies: true };

    await User.updateOne({ _id: user._id }, { $push: { friends: friendObjForUser } });
    await User.updateOne({ _id: friend._id }, { $push: { friends: userObjForFriend } });

    res.json({ result: true, message: `Vous êtes maintenant ami avec ${friend.username} !` });

  } catch (error) {
    console.error("Erreur ajout ami:", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});
// ROUTE : Mettre à jour les permissions d'un ami
router.put('/update-friend-permissions', async (req, res) => {
  try {
    const { token, friendId, canSeeMyCollection, canAskForMovies } = req.body;

    if (!token || !friendId) {
      return res.json({ result: false, error: 'Paramètres manquants' });
    }

    const updateResult = await User.updateOne(
      { token: token, "friends.userid": friendId },
      { 
        $set: { 
          "friends.$.canSeeMyCollection": canSeeMyCollection,
          "friends.$.canAskForMovies": canAskForMovies 
        } 
      }
    );

    if (updateResult.modifiedCount > 0) {
      res.json({ result: true, message: 'Permissions mises à jour avec succès !' });
    } else {
      res.json({ result: false, error: 'Ami non trouvé ou permissions inchangées.' });
    }

  } catch (error) {
    console.error("Erreur mise à jour permissions:", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});


// ROUTE : Récupérer la collection d'un ami (si autorisé)
router.post('/friend-collection', async (req, res) => {
  try {
    const { token, friendId } = req.body;

    const me = await User.findOne({ token: token });
    if (!me) return res.json({ result: false, error: 'Utilisateur non trouvé' });

    const friend = await User.findById(friendId).populate('movies.movieid');
    if (!friend) return res.json({ result: false, error: 'Ami introuvable' });

    const myPermissions = friend.friends.find(f => f.userid.toString() === me._id.toString());
    if (!myPermissions || !myPermissions.canSeeMyCollection) {
      return res.json({ result: false, error: 'Cet ami a restreint l\'accès à sa collection.' });
    }
    const formattedMovies = await Promise.all(
      friend.movies.map(async (movieObj) => {
        return await getMovieTreated(movieObj);
      })
    );

    const finalMovies = formattedMovies.filter(m => m !== null);

    res.json({ result: true, movies: finalMovies });

  } catch (error) {
    console.error("Erreur récupération collection ami:", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});

// ROUTE : Demander à emprunter un film
router.post('/ask-movie', async (req, res) => {
  try {
    const { token, friendId, tmdb_id } = req.body;

    // Sécurité : on vérifie que l'ID n'est pas vide
    if (!tmdb_id) return res.json({ result: false, error: 'ID du film manquant' });

    const me = await User.findOne({ token: token });
    if (!me) return res.json({ result: false, error: 'Utilisateur non trouvé' });

    // 1. On peuple directement les films de l'ami pour y voir clair
    const friend = await User.findById(friendId).populate('movies.movieid');
    if (!friend) return res.json({ result: false, error: 'Ami introuvable' });

    // 2. Vérification de tes droits
    const myPermissions = friend.friends.find(f => f.userid.toString() === me._id.toString());
    if (!myPermissions || !myPermissions.canAskForMovies) {
      return res.json({ result: false, error: 'Cet ami ne vous autorise pas à lui demander des films.' });
    }

   
    const movieToAsk = friend.movies.find(m => m.movieid && m.movieid.tmdb_id == tmdb_id);

    if (!movieToAsk) {
      return res.json({ result: false, error: 'Ce film n\'est plus dans sa collection.' });
    }
    if (movieToAsk.isLoaned) {
      return res.json({ result: false, error: 'Impossible : ce film est déjà en cours de prêt.' });
    }

    // 4. On vérifie si tu n'es pas déjà dans le tableau isAsked
    const alreadyAsked = movieToAsk.isAsked.some(id => id.toString() === me._id.toString());
    if (alreadyAsked) {
      return res.json({ result: false, error: 'Vous avez déjà demandé ce film !' });
    }

    await User.updateOne(
      { _id: friend._id, "movies._id": movieToAsk._id },
      { $push: { "movies.$.isAsked": me._id, "notifications": { type: 'loan_request', senderId: me._id, movieId: movieToAsk._id }}}
    );

    res.json({ result: true, message: 'Votre demande a bien été envoyée à votre ami !' });

  } catch (error) {
    console.error("Erreur demande film:", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});

// Route: recevoir les notifications
router.get('/notifications/:token', async (req, res) => {
  try {
    const me = await User.findOne({ token: token }).populate('notifications.senderId', 'username friendCode').populate('notifications.movieId', 'title-fr original_title poster_path tmdb_id')
    if (!me) {
      return res.json ({ result: false, error: 'utilisateur non trouvé' });
    }
    const sortedNotifications = me.notifications.sort((a, b) => b.createdAt - a.createdAt);
    res.json({ result: true, notifications: sortedNotifications });
  } catch (error) {
    console.error("Erreur dans notifications :", error);  
    }
})  
module.exports = router;  

