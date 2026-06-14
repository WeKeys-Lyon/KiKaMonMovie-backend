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
const {getMovieTreated, makeACard} = require('../modules/makeACard');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');


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
        // 4.3 On va préparer les amis
        async function getLocalFriends(userData) {
       
        if (userData.friends) {
          
          const myResults = await Promise.all( userData.friends.map(async friend => {
            /* let myMovies = {id: movie.movieid.tmdb_id} */
            const friendData = await User.findOne({_id: friend.userid}, {username: 1});
            return await friendData
            }) )
          return await myResults;
              }
            }
          // 4.2 On prépare les données depuis userExists et on lance la fonction de formattage
        
        const userFriends = await getLocalFriends(userData);
        // 5. Sortie pour le reducer
        res.status(200).send({result: true, answer: { _id: userExists._id, username: userExists.username, email: userExists.email, token: userExists.token, movies:  userMovies, friends: userFriends, friendCode: userExists.friendCode, notifications: userExists.notifications }})
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
      const resultCloudinary = await cloudinary.uploader.upload(`https://image.tmdb.org/t/p/w500${movie.poster_path}`, {use_filename: true, unique_filename: false});
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
// Ajouter un groupe de films en masse
router.post('/add-movies', async (req, res) => {
  try {
    if (!checkBody(req.body, ['token', 'moviesid'])) {
        return res.status(400).send({result: false, answer : 'Missing parameters'});
    }
    const { token, moviesid } = req.body;
        const formattedMovies = await Promise.all (moviesid.map(async (movie) => {

        // 1. Trouver l'utilisateur
          const user = await User.findOne({ token: token });
                if (!user) {
        return res.json({ result: false, error: 'Utilisateur introuvable' });
      }
        // 2. Vérifier si le film existe déjà dans la BDD Globale
        
        let existingMovie = await Movie.findOne({ tmdb_id: movie });
        if(!existingMovie) {
          const result = await getMovieTreated({movieid: {tmdb_id: movie}})
          // -- GESTION DES RÉALISATEURS --
          const directorsIds = [];
          for (const directorData of (result.DirectedBy || [])) {
            const director = await Director.findOneAndUpdate(
              { tmdb_director_id: directorData.tmdb_director_id }, // Recherche
              { name: directorData.name, popularity: directorData.popularity }, // Mise à jour
              { returnDocument: 'after', upsert: true } // Création si inexistant
            );
            directorsIds.push({ directorid: director._id });
          };

              // -- GESTION DU CASTING --
          const actorsIds = [];
          for (const actorData of (result.Cast || [])) {
            const castMember = await Cast.findOneAndUpdate(
              { tmdb_actor_id: actorData.tmdb_actor_id },
              { name: actorData.name, popularity: actorData.popularity },
              { returnDocument: 'after', upsert: true }
            );
            actorsIds.push({ actorid: castMember._id }); 
          }
          
          // -- GESTION DES GENRES --
        const genresIds = [];
        for (const genreData of (result.Genres || [])) { 
          const genre = await Genre.findOneAndUpdate(
            { tmdb_genre_id: genreData.tmdb_genre_id },
            { name: genreData.name }, // Les genres n'ont généralement pas de popularité
            { returnDocument: 'after', upsert: true }
          );
          genresIds.push({ genreid: genre._id });
        }
        // -- GESTION DES COMPOSITEURS --
        const composersIds = [];
        for (const composerData of (result.MusicBy || [])) {
          const composer = await Composer.findOneAndUpdate(
            { tmdb_composer_id: composerData.tmdb_composer_id },
            { name: composerData.name, popularity: composerData.popularity },
            { returnDocument: 'after', upsert: true }
          );
          composersIds.push({ composerid: composer._id });
        }

        // -- CRÉATION DU FILM EN BDD --
        const newMovie = new Movie({
          tmdb_id: result.tmdb_id,
          original_title: result.original_title,
          title_fr: result.title_fr,
          release_date: result.release_date,
          poster_path: result.poster_path,
          DirectedBy: directorsIds,
          Cast: actorsIds,
          Genres: genresIds,
          MusicBy: composersIds,
          popularity: result.popularity
        });
        const resultCloudinary = await cloudinary.uploader.upload(`https://image.tmdb.org/t/p/w500${result.poster_path}`, {use_filename: true, unique_filename: false});
        existingMovie = await newMovie.save();
         // 5. Ajouter le film à l'utilisateur
        user.movies.push({
          movieid: existingMovie._id,
          isLoaned: false,
          isLiked: false 
        });
        await user.save();
        
        return await result
        } else {

              // 4. Vérifier si le film est DÉJÀ dans la collection de L'UTILISATEUR
          const isAlreadyInCollection = user.movies.some(
            (m) => m.movieid && m.movieid.toString() === existingMovie._id.toString()
          );

          if (isAlreadyInCollection) {
            return await getMovieTreated({movieid: {tmdb_id: existingMovie.tmdb_id}});
          }
          // 5. Ajouter le film à l'utilisateur
        user.movies.push({
          movieid: existingMovie._id,
          isLoaned: false,
          isLiked: false 
        });
        await user.save();
        
        return await getMovieTreated({movieid: {tmdb_id: existingMovie.tmdb_id}});
        }
      }
      )
      )
      res.status(200).send({result: true, answer: formattedMovies})
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
          if (req.body.notificationId) {
            user.notifications = user.notifications.filter(
              n => n._id.toString() !== req.body.notificationId
            );
          }
          if (req.body.userid) {
            user.movies[movieIndex].isAsked = user.movies[movieIndex].isAsked.filter(
              id => id.toString() !== req.body.userid.toString()
            );
          }
          await user.save();
          if (req.body.userid && req.body.isSharedToUser) {
            const friend = await User.findById(req.body.userid);
            if (friend) {
              friend.notifications.push({
                type: 'loan_accepted',
                senderId: user._id,
                movieId: myID._id
              });
              await friend.save();
            }
          }

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
    
    // Si l'utilisateur veut changer son mot de passe, on le crypte d'abord
    if (newPassword) {
      const hash = bcrypt.hashSync(newPassword, 10);
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

// ROUTE : Supprimer la collection définitivement
router.delete('/user-collection', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.json({ result: false, error: 'Token manquant' });
    }

    const user = await User.findOne({ token: token });

    user.movies = [];
    await user.save();

    res.json({ result: true, answer: user });

  } catch (error) {
    console.error("Erreur suppression compte:", error);
    res.json({ result: false, error: 'Erreur serveur' });
  }
});
// ROUTE : Récupérer son code ami et sa liste d'amis
router.post('/my-social-data', async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findOne({ token: token }).populate('friends.userid', 'username friendCode').populate('pendingRequests', 'username');
    if (!user) return res.json({ result: false, error: 'Utilisateur introuvable' });

    res.json({ 
      result: true, 
      friendCode: user.friendCode,
      friends: user.friends,
      pendingRequests: user.pendingRequests
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

    // 1. On vérifie s'ils sont déjà amis
    const alreadyFriends = user.friends.some(f => f.userid.toString() === friend._id.toString());
    if (alreadyFriends) {
      return res.json({ result: false, error: 'Vous êtes déjà amis avec cet utilisateur.' });
    }

    const alreadyRequested = friend.notifications.some(
      n => n.type === 'friend_request' && n.senderId && n.senderId.toString() === user._id.toString()
    );
    if (alreadyRequested) {
      return res.json({ result: false, error: 'Une demande est déjà en attente pour cet utilisateur.' });
    }

    //On pousse juste la notification chez l'ami
    friend.notifications.push({
      type: 'friend_request',
      senderId: user._id
    });

    await friend.save(); // On sauvegarde l'envoi de la notification

    user.pendingRequests.push(friend._id);
    await user.save();


    res.json({ result: true, message: `Votre demande d'ami a bien été envoyée à ${friend.username} !`, answer: {_id: friend._id, username: friend.username} });

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
      { $push: { "movies.$.isAsked": me._id, "notifications": { type: 'loan_request', senderId: me._id, movieId: movieToAsk.movieid._id }}}
    );

    res.json({ result: true, message: 'Votre demande a bien été envoyée à votre ami !' });

  } catch (error) {
    console.error("Erreur demande film:", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});
// Route: recevoir les notifications et vérifier les dates de fin de prêt
router.get('/notifications/:token', async (req, res) => {
  try {
    const token = req.params.token;
    
    const me = await User.findOne({ token: token })
      .populate('movies.movieid') 
      .populate('notifications.senderId', 'username friendCode')
      .populate('notifications.movieId', 'title_fr original_title poster_path tmdb_id');
      
    if (!me) {
      return res.json({ result: false, error: 'utilisateur non trouvé' });
    }

    // VÉRIFICATION DES RETARDS 
    const today = new Date();
    let hasNewNotifications = false;

    me.movies.forEach(myMovie => {
      // Si le film est prêté actuellement
      if (myMovie.isLoaned && myMovie.pastLoans && myMovie.pastLoans.length > 0) {
        const currentLoan = myMovie.pastLoans[myMovie.pastLoans.length - 1];
        
        // Si la date est dépassée
        if (currentLoan.dueDate && new Date(currentLoan.dueDate) < today && currentLoan.Notification === true) {
          
          // On vérifie qu'on n'a pas déjà généré cette notification pour ce film
          const alreadyNotified = me.notifications.some(n => 
            n.type === 'loan_expired' && 
            n.movieId && n.movieId._id.toString() === myMovie.movieid._id.toString()
          );

          if (!alreadyNotified) {
            me.notifications.push({
              type: 'loan_expired',
              movieId: myMovie.movieid._id,
              senderId: currentLoan.userid // Pour savoir à qui on a prêté
            });
            hasNewNotifications = true;
          }
        }
      }
    });

    // Si on a ajouté de nouvelles notifications, on sauvegarde et on les peuple
    if (hasNewNotifications) {
      await me.save();
      await me.populate([
        { path: 'notifications.senderId', select: 'username friendCode' },
        { path: 'notifications.movieId', select: 'title_fr original_title poster_path tmdb_id' }
      ]);
    }
  

    // tri exact pour afficher les plus récentes en premier
    const sortedNotifications = me.notifications.sort((a, b) => b.createdAt - a.createdAt);
    
    res.json({ result: true, notifications: sortedNotifications });
    
  } catch (error) {
    console.error("Erreur dans notifications :", error);
    res.json({ result: false, error: 'Erreur serveur interne' }); 
  }
});
router.post('/isLiked', async (req, res) => {
  if (!checkBody(req.body, ['token', 'tmdb_id'])) {
      res.status(400).send({result: false, answer : 'Missing parameters'});
      return;
  }
  try {
    const user = await User.findOne({token: req.body.token});
    const myID = await Movie.findOne({tmdb_id: req.body.tmdb_id}).select('_id');    
    if (user) {
        //On va chercher dans quel index de movies se trouve le film séléctionné
        const movieIndex = user.movies.findIndex(movie => movie.movieid.toString() == myID._id);
        if (movieIndex !== -1) {
          //On ajoute notre document newLoan dans pastLoans
          (user.movies[movieIndex].isLiked) ? user.movies[movieIndex].isLiked = false : user.movies[movieIndex].isLiked = true;
          await user.save();

          res.status(200).send({result: true, answer: user.movies[movieIndex].isLiked })
        } else {
          res.status(200).send({result: false, error: 'Film introuvable' });
        }
      } else {
        res.status(200).send({result: false, error: 'Utilisateur introuvable' })
      }
  } catch (error) {
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
})
// ROUTE : Refuser une demande de prêt
router.post('/refuse-loan', async (req, res) => {
  try {
    const { token, tmdb_id, notificationId, requesterId } = req.body;

    // 1. On récupère ton profil et on peuple tes films pour trouver le bon avec le tmdb_id
    const me = await User.findOne({ token: token }).populate('movies.movieid');
    if (!me) return res.json({ result: false, error: 'Utilisateur introuvable' });

    // 2. Nettoyage de ta boîte de réception (on supprime la notification)
    me.notifications = me.notifications.filter(n => n._id.toString() !== notificationId);

    // 3. Nettoyage de la liste d'attente du film
    const myMovie = me.movies.find(m => m.movieid && m.movieid.tmdb_id === tmdb_id);
    if (myMovie) {
        myMovie.isAsked = myMovie.isAsked.filter(id => id.toString() !== requesterId);
    }
    await me.save(); // On sauvegarde tes modifications

    // 4. Prévenir l'ami (envoi de la notification de refus)
    const friend = await User.findById(requesterId);
    if (friend && myMovie) {
        friend.notifications.push({
            type: 'loan_refused',
            senderId: me._id,
            movieId: myMovie.movieid._id
        });
        await friend.save();
    }

    res.json({ result: true, message: 'Demande refusée avec succès' });

  } catch (error) {
    console.error("Erreur lors du refus du prêt :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});
// ROUTE : Supprimer une notification
router.post('/delete-notification', async (req, res) => {
  try {
    const { token, notificationId } = req.body;
    
    const user = await User.findOne({ token: token });
    if (!user) return res.json({ result: false, error: 'Utilisateur introuvable' });

    // On filtre le tableau pour garder toutes les notifications SAUF celle qu'on veut supprimer
    user.notifications = user.notifications.filter(n => n._id.toString() !== notificationId);
    
    await user.save();
    res.json({ result: true, message: 'Notification supprimée' });

  } catch (error) {
    console.error("Erreur lors de la suppression de la notification :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});
// ROUTE : Marquer toutes les notifications comme lues
router.post('/mark-all-read', async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findOne({ token: token });
    if (!user) return res.json({ result: false, error: 'Utilisateur introuvable' });

    // On passe isRead à true pour toutes les notifications
    user.notifications.forEach(notification => {
      notification.isRead = true;
    });

    await user.save();
    res.json({ result: true, message: 'Toutes les notifications sont marquées comme lues' });

  } catch (error) {
    console.error("Erreur mark-all-read :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});
// route pour accepter un ami
router.post('/accept-friend', async (req, res) => {
  try {
    const { token, notificationId, senderId } = req.body;

    // 1. On cherche les deux utilisateurs
    const me = await User.findOne({ token: token });
    const friend = await User.findById(senderId);

    if (!me || !friend) {
      return res.json({ result: false, error: 'Utilisateur introuvable' });
    }

    // 2. On vérifie s'ils ne sont pas déjà amis (sécurité)
    const alreadyFriends = me.friends.some(f => f.userid.toString() === senderId.toString());
    
    if (!alreadyFriends) {
      // 3. On ajoute l'ami chez moi avec les permissions par défaut
      me.friends.push({
        userid: friend._id,
        canSeeMyCollection: true,
        canAskForMovies: true
      });

      // 4. On m'ajoute chez l'ami avec les permissions par défaut (réciproque)
      friend.friends.push({
        userid: me._id,
        canSeeMyCollection: true,
        canAskForMovies: true
      });

      if (friend.pendingRequests) {
        friend.pendingRequests = friend.pendingRequests.filter(id => id.toString() !== me._id.toString());
      }

      friend.notifications.push({
        type: 'friend_accepted',
        senderId: me._id // 
      });
      
      await friend.save(); // On sauvegarde les modifications chez l'ami
    }

    // 5. On supprime la notification de demande
    me.notifications = me.notifications.filter(n => n._id.toString() !== notificationId);
    await me.save(); // On sauvegarde mes modifications

    res.json({ result: true, message: 'Ami ajouté avec succès !' });

  } catch (error) {
    console.error("Erreur accept-friend :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});
//refuser un ami
router.post('/refuse-friend', async (req, res) => {
  try {
    const { token, notificationId, senderId } = req.body;

    const me = await User.findOne({ token: token });
    if (!me) {
      return res.json({ result: false, error: 'Utilisateur introuvable' });
    }

    // On se contente de supprimer la notification de la liste
    me.notifications = me.notifications.filter(n => n._id.toString() !== notificationId);
    
    await me.save();

    if (senderId) {
      const friend = await User.findById(senderId);
      if (friend && friend.pendingRequests) {
        friend.pendingRequests = friend.pendingRequests.filter(id => id.toString() !== me._id.toString());
      }
      friend.notifications.push({
          type: 'friend_refused',
          senderId: me._id 
        });
      await friend.save();
    }
    
    res.json({ result: true, message: 'Demande refusée et supprimée.' });

  } catch (error) {
    console.error("Erreur refuse-friend :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});
// ROUTE : Envoyer un rappel à un emprunteur
router.post('/remind-loan', async (req, res) => {
  try {
    const { token, borrowerId, movieId } = req.body;

    const me = await User.findOne({ token: token });
    const friend = await User.findById(borrowerId);

    if (!me || !friend) {
      return res.json({ result: false, error: 'Utilisateur introuvable' });
    }

    // Sécurité Anti-Spam : On vérifie si l'ami a DÉJÀ un rappel non supprimé pour ce film
    const alreadyReminded = friend.notifications.some(n => 
      n.type === 'loan_reminder' && 
      n.movieId && n.movieId.toString() === movieId.toString()
    );

    if (alreadyReminded) {
      return res.json({ result: false, error: 'Un rappel a déjà été envoyé à cet utilisateur récemment.' });
    }

    // On crée la notification chez l'ami
    friend.notifications.push({
      type: 'loan_reminder',
      senderId: me._id,
      movieId: movieId
    });

    await friend.save();

    res.json({ result: true, message: 'Un rappel a été envoyé à votre ami !' });

  } catch (error) {
    console.error("Erreur remind-loan :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});

// ROUTE : Marquer un film comme récupéré (depuis le Modal ou MyShares)
router.post('/remove-loan', async (req, res) => {
  try {
    const { token, tmdb_id } = req.body;
    
    // 🚨 MOUCHARD 1 : Vérifier ce que le frontend envoie
    console.log("📥 [1] REQUÊTE /remove-loan REÇUE ! tmdb_id envoyé :", tmdb_id);

    const me = await User.findOne({ token: token }).populate('movies.movieid');
    if (!me) {
      console.log("❌ [2] Utilisateur introuvable !");
      return res.json({ result: false, error: 'Utilisateur introuvable' });
    }

    // 🚨 MOUCHARD 2 : Vérifier la recherche du film
    const movieIndex = me.movies.findIndex(m => m.movieid && m.movieid.tmdb_id === tmdb_id);
    console.log("🔍 [3] Résultat de la recherche du film (Index) :", movieIndex);
    
    if (movieIndex !== -1) {
      const myMovie = me.movies[movieIndex];
      console.log("✅ [4] FILM TROUVÉ ! Historique des prêts :", myMovie.pastLoans?.length, "prêts.");
      
      myMovie.isLoaned = false;

      if (myMovie.pastLoans && myMovie.pastLoans.length > 0) {
        const lastLoan = myMovie.pastLoans[myMovie.pastLoans.length - 1];
        const borrowerId = lastLoan.userid;
        console.log("👤 [5] ID de l'emprunteur trouvé :", borrowerId);

        if (borrowerId) {
          const borrower = await User.findById(borrowerId);
          if (borrower) {
            borrower.notifications.push({
              type: 'loan_returned',
              senderId: me._id, 
              movieId: myMovie.movieid._id, 
              createdAt: new Date()
            });
            await borrower.save();
            console.log("🔔 [6] NOTIFICATION SAUVEGARDÉE CHEZ L'EMPRUNTEUR !");
          } else {
             console.log("❌ [6] Impossible de trouver l'emprunteur dans la base User !");
          }
        }
      } else {
         console.log("⚠️ [5] Aucun historique 'pastLoans' trouvé pour ce film !");
      }

      await me.save();
      res.json({ result: true, message: 'Film récupéré et emprunteur notifié !' });
      
    } else {
      console.log("❌ [4] ERREUR : Le film n'a pas été trouvé dans le tableau 'movies' de l'utilisateur !");
      res.json({ result: false, error: 'Film non trouvé dans la collection' });
    }

  } catch (error) {
    console.error("🚨 ERREUR CRITIQUE /remove-loan :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});

// ROUTE : Supprimer un ami
router.delete('/remove-friend', async (req, res) => {
  try {
    const { token, friendId } = req.body;

    const me = await User.findOne({ token: token });
    const friend = await User.findById(friendId);

    if (!me || !friend) {
      return res.json({ result: false, error: 'Utilisateur introuvable' });
    }

    // 1. On retire l'ami de ma liste
    me.friends = me.friends.filter(f => f.userid.toString() !== friendId.toString());
    await me.save();

    // 2. On me retire de la liste de l'ami (réciproque)
    friend.friends = friend.friends.filter(f => f.userid.toString() !== me._id.toString());
    await friend.save();

    res.json({ result: true, message: 'Ami supprimé avec succès.' });

  } catch (error) {
    console.error("Erreur remove-friend :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});

// ROUTE : Récupérer les films prêtés et empruntés (My Shares)
router.post('/my-shares', async (req, res) => {
  try {
    const { token } = req.body;

    // 1. On trouve l'utilisateur actuel (toi)
    const me = await User.findOne({ token: token }).populate('movies.movieid').populate({
      path: 'movies.pastLoans.userid',
      select: 'username',
      model: 'users'
    });
    if (!me) {
      return res.json({ result: false, error: 'Utilisateur introuvable' });
    }

    // 2. MISSION A : Récupérer TES films prêtés
    const myLoanedMovies = me.movies
      .filter(movie => movie.isLoaned === true)
      .map(movie => {
        return {
          ...movie.toObject(),
          shareType: 'loaned', 
          ownerName: 'Moi'
        };
      });

    // 3. MISSION B : Récupérer les films que TU as empruntés
    let myBorrowedMovies = [];
    
    // On cherche parmi tes amis (pour optimiser la recherche)
    const friendsIds = me.friends.map(f => f.userid);
    
    // On récupère les profils de tes amis avec leurs films peuplés
    const friends = await User.find({ _id: { $in: friendsIds } }).populate('movies.movieid');

    // On fouille dans la collection de chaque ami
    for (const friend of friends) {
      const borrowedFromFriend = friend.movies
        .filter(movie => {
          // Si le film n'est pas prêté ou n'a pas d'historique, on l'ignore
          if (!movie.isLoaned || !movie.pastLoans || movie.pastLoans.length === 0) return false;
          
          // On regarde le prêt EN COURS (le dernier du tableau)
          const currentLoan = movie.pastLoans[movie.pastLoans.length - 1];
          
          // On vérifie si c'est un prêt "in-app" et si le userid correspond à ton ID
          return currentLoan.isSharedToUser && 
                 currentLoan.userid && 
                 currentLoan.userid.toString() === me._id.toString();
        })
        .map(movie => {
          return {
            ...movie.toObject(),
            shareType: 'borrowed', // 👈 L'autre étiquette magique
            ownerName: friend.username, // On garde le nom du propriétaire pour l'afficher sur la fiche !
            ownerId: friend._id
          };
        });

      // On ajoute ces films trouvés à notre grande liste
      myBorrowedMovies = [...myBorrowedMovies, ...borrowedFromFriend];
    }

    // 4. On fusionne les deux listes
    const allShares = [...myLoanedMovies, ...myBorrowedMovies];

    res.json({ result: true, shares: allShares });

  } catch (error) {
    console.error("Erreur /my-shares :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});
// ROUTE : Ajouter un avis sur un film
router.post('/add-review', async (req, res) => {
  try {
    const { token, ownerId, tmdb_id, rating, comment } = req.body;

    // 1. Identifier l'utilisateur qui poste l'avis
    const me = await User.findOne({ token: token });
    if (!me) return res.json({ result: false, error: 'Utilisateur introuvable' });

    // 🌟 LA CLÉ EST ICI : On récupère d'abord l'ID global du film (Comme dans ton add-loan !)
    const myMovieDB = await Movie.findOne({ tmdb_id: tmdb_id }).select('_id');
    if (!myMovieDB) return res.json({ result: false, error: 'Film inconnu dans la base' });

    // 2. Identifier le propriétaire (SANS POPULATE ! Ça débloque la sauvegarde)
    const targetUserId = ownerId || me._id;
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.json({ result: false, error: 'Propriétaire introuvable' });

    // 3. Trouver l'index exact du film dans sa collection
    const movieIndex = targetUser.movies.findIndex(m => m.movieid.toString() === myMovieDB._id.toString());
    if (movieIndex === -1) return res.json({ result: false, error: 'Film introuvable dans la collection' });

    const targetMovie = targetUser.movies[movieIndex];

    // 🔒 4. VÉRIFICATIONS 
    if (targetUserId.toString() !== me._id.toString()) {
      const hasBorrowed = targetMovie.pastLoans.some(loan => {
        const borrowerId = loan.userid?._id || loan.userid;
        return borrowerId && borrowerId.toString() === me._id.toString();
      });
      if (!hasBorrowed) return res.json({ result: false, error: "Vous devez avoir emprunté ce film pour laisser un avis." });

      const friendData = targetUser.friends.find(f => {
        const fId = f.userid?._id || f.userid;
        return fId && fId.toString() === me._id.toString();
      });
      if (!friendData) return res.json({ result: false, error: "Vous n'êtes pas amis avec ce propriétaire." });

      if (rating > 0 && !friendData.canRate) return res.json({ result: false, error: "L'auteur ne vous autorise pas à noter ses films." });
      if (comment && comment.trim().length > 0 && !friendData.canComment) return res.json({ result: false, error: "L'auteur ne vous autorise pas à commenter." });
    }

    const newReview = {
      userid: me._id,
      rating: rating,
      comment: comment,
      createdAt: new Date()
    };

    // On donne l'ordre direct à la base de données d'injecter ($push) l'avis
    const updateResult = await User.updateOne(
      { _id: targetUser._id, "movies.movieid": myMovieDB._id },
      { $push: { "movies.$.reviews": newReview } }
    );

    // 🌟 NOTRE DÉTECTEUR DE MENSONGE :
    console.log("Rapport MongoDB :", updateResult);

    if (updateResult.modifiedCount > 0) {
      
      // 🌟 NOUVEAU : ENVOI DE LA NOTIFICATION AU PRÊTEUR 🌟
      // On vérifie qu'on n'est pas en train de noter notre propre film
      if (targetUserId.toString() !== me._id.toString()) {
        await User.updateOne(
          { _id: targetUser._id },
          { 
            $push: { 
              notifications: {
                type: 'review_posted',
                senderId: me._id,      // L'emprunteur qui a écrit l'avis
                movieId: myMovieDB._id // Le film concerné
              }
            } 
          }
        );
        console.log("🔔 Notification 'review_posted' envoyée au prêteur !");
      }

      res.json({ result: true, message: 'Avis publié avec succès !' });
    } else {
      res.json({ result: false, error: 'MongoDB a refusé de sauvegarder.' });
    }

    
  } catch (error) {
    console.error("Erreur /add-review :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});

// ROUTE : Liker ou Unliker un avis (🔒 Réservé au propriétaire)
router.post('/like-review', async (req, res) => {
  try {
    const { token, tmdb_id, reviewId } = req.body;
    
    const me = await User.findOne({ token: token });
    if (!me) return res.json({ result: false, error: 'Utilisateur introuvable' });

    const myMovieDB = await Movie.findOne({ tmdb_id: tmdb_id }).select('_id');
    if (!myMovieDB) return res.json({ result: false, error: 'Film inconnu' });

    // 🔒 SÉCURITÉ : On cherche le film UNIQUEMENT dans la collection de celui qui fait l'action (le propriétaire)
    const movieIndex = me.movies.findIndex(m => m.movieid.toString() === myMovieDB._id.toString());
    if (movieIndex === -1) return res.json({ result: false, error: 'Action interdite : Ce film n\'est pas dans votre collection' });

    // On cherche l'avis spécifique
    const reviewIndex = me.movies[movieIndex].reviews.findIndex(r => r._id.toString() === reviewId);
    if (reviewIndex === -1) return res.json({ result: false, error: 'Avis introuvable' });

    const review = me.movies[movieIndex].reviews[reviewIndex];

    // Toggle du Like (Si je l'ai déjà liké, je l'enlève. Sinon, je l'ajoute)
    const alreadyLiked = review.likes.some(id => id.toString() === me._id.toString());
    if (alreadyLiked) {
      review.likes = review.likes.filter(id => id.toString() !== me._id.toString());
    } else {
      review.likes.push(me._id);
    }

    // On sauvegarde (ça marchera parfaitement car on n'a pas utilisé populate !)
    await me.save(); 
    
    res.json({ result: true, message: 'Like mis à jour !' });

  } catch (error) {
    console.error("Erreur /like-review :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});

// ROUTE : Répondre à un avis (🔒 Réservé au propriétaire)
router.post('/reply-review', async (req, res) => {
  try {
    const { token, tmdb_id, reviewId, text } = req.body;

    if (!text || text.trim() === '') return res.json({ result: false, error: 'La réponse ne peut pas être vide' });

    const me = await User.findOne({ token: token });
    if (!me) return res.json({ result: false, error: 'Utilisateur introuvable' });

    const myMovieDB = await Movie.findOne({ tmdb_id: tmdb_id }).select('_id');
    if (!myMovieDB) return res.json({ result: false, error: 'Film inconnu' });

    // 🔒 SÉCURITÉ : Idem, on restreint la recherche à la collection du propriétaire
    const movieIndex = me.movies.findIndex(m => m.movieid.toString() === myMovieDB._id.toString());
    if (movieIndex === -1) return res.json({ result: false, error: 'Action interdite : Ce film n\'est pas dans votre collection' });

    const reviewIndex = me.movies[movieIndex].reviews.findIndex(r => r._id.toString() === reviewId);
    if (reviewIndex === -1) return res.json({ result: false, error: 'Avis introuvable' });

    const newReply = {
      userid: me._id,
      text: text,
      createdAt: new Date()
    };

    me.movies[movieIndex].reviews[reviewIndex].replies.push(newReply);
    await me.save();

    res.json({ result: true, message: 'Réponse publiée avec succès !' });

  } catch (error) {
    console.error("Erreur /reply-review :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});
module.exports = router;  

