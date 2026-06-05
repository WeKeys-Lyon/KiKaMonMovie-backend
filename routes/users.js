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
    const newUser = new User({
        username: req.body.username,
        password: passwordHash,
        email: req.body.email,
        token: token
    });
    await newUser.save();
    res.status(201).send({result: true, answer : {username: newUser.username, email: newUser.email, token: newUser.token, movies: newUser.movies || []}});
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
            let myMovies = {id: movie.movieid.tmdb_id}
            return await getMovieTreated(myMovies)
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

    // 3. SI LE FILM N'EXISTE PAS : On peuple les collections
    if (!existingMovie) {
      
      // -- GESTION DES RÉALISATEURS --
      const directorsIds = [];
      for (const directorData of (movie.DirectedBy || [])) {
        let director = await Director.findOne({ tmdb_director_id: directorData.tmdb_director_id });
        if (!director) {
          director = new Director({ name: directorData.name, tmdb_director_id: directorData.tmdb_director_id, popularity: directorData.popularity });
          await director.save();
        }
        directorsIds.push({ directorid: director._id });
      }

      // -- GESTION DU CASTING --
      const actorsIds = [];
      for (const actorData of (movie.Cast || [])) {
        let castMember = await Cast.findOne({ tmdb_actor_id: actorData.tmdb_actor_id });
        if (!castMember) {
          castMember = new Cast({ name: actorData.name, tmdb_actor_id: actorData.tmdb_actor_id, popularity: actorData.popularity });
          await castMember.save();
        }
        actorsIds.push({ actorid: castMember._id }); 
      }

      // -- GESTION DES GENRES (👈 CORRECTION : Genres au lieu de genre) --
      const genresIds = [];
      for (const genreData of (movie.Genres || [])) { 
        let genre = await Genre.findOne({ tmdb_genre_id: genreData.tmdb_genre_id });
        if (!genre) {
          genre = new Genre({ name: genreData.name, tmdb_genre_id: genreData.tmdb_genre_id });
          await genre.save();
        }
        genresIds.push({ genreid: genre._id });
      }

      // -- GESTION DES COMPOSITEURS --
      const composersIds = [];
      for (const composerData of (movie.MusicBy || [])) {
        let composer = await Composer.findOne({ tmdb_composer_id: composerData.tmdb_composer_id, popularity: composerData.popularity });
        if (!composer) {
          composer = new Composer({ name: composerData.name, tmdb_composer_id: composerData.tmdb_composer_id, popularity: composerData.popularity });
          await composer.save();
        }
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
    // 👈 CORRECTION : On cible bien "m.movieid" pour la comparaison
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
      isLiked: false // 👈 CORRECTION : On ajoute isLiked car c'est "required: true" dans ton modèle !
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
          res.status(200).send({result: false, answer: 'Film introuvable' });
        }
      } else {
        res.status(200).send({result: false, answer: 'Utilisateur introuvable' })
      }
      
      
  } catch (error) {
    console.error("Erreur critique :", error);
    res.json({ result: false, error: 'Erreur serveur interne' });
  }
});
module.exports = router;  

