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

//connexion d'un utilisateur déjà inscrit
router.post('/signin', async (req, res) => {
    if (!checkBody(req.body, ['mylogin', 'password'])) {
        res.status(200).send({result: false, answer : 'Missing parameters'});
        return;
    }
    const username = await User.findOne({username: req.body.mylogin});
    const email = await User.findOne({email: req.body.mylogin});
    let userExists = '';
    if (username) {
        userExists = username;
    } else if (email) {
        userExists = email;
    } else {
      res.status(200).send({result: false, answer : 'Utilisateur ou Email inconnu'});
      return;
    }
   
    if ( !bcrypt.compareSync(req.body.password, userExists.password) ) {
        res.status(200).send({result: false, answer : 'User not found or wrong password'});
        return;
    } else {

        (username) ? res.status(200).send({result: true, answer: { username: username.username, email: username.email, token: username.token, movies: username.movies }}) : res.status(200).send({result: true, answer: { username: email.username, email: email.email, token: email.token, movies: email.movies }})
    }
    
});

//ajouter un film
router.post('/add-movie', async (req, res) => {
  try {     
    const { token, movie } = req.body;

    // 1. Trouver l'utilisateur
    const user = await User.findOne({ token: token });
    if (!user) {
      return res.json({ result: false, error: 'Utilisateur introuvable' });
    }

    // 2. Vérifier si le film existe déjà
    let existingMovie = await Movie.findOne({ tmdb_id: movie.tmdb_id });

    // 3. SI LE FILM N'EXISTE PAS : On peuple tes 4 collections !
    if (!existingMovie) {
      
      // -- GESTION DES RÉALISATEURS (directors.js) --
      const directorsIds = [];
      for (const directorData of (movie.DirectedBy || [])) {
        let director = await Director.findOne({ tmdb_director_id: directorData.tmdb_director_id });
        if (!director) {
          director = new Director({ name: directorData.name, tmdb_director_id: directorData.tmdb_director_id, popularity: directorData.popularity });
          await director.save();
        }
        directorsIds.push({ directorid: director._id });
      }

      // -- GESTION DU CASTING (cast.js) --
      const actorsIds = [];
      for (const actorData of (movie.Cast || [])) {
        let castMember = await Cast.findOne({ tmdb_actor_id: actorData.tmdb_actor_id });
        if (!castMember) {
          castMember = new Cast({ name: actorData.name, tmdb_actor_id: actorData.tmdb_actor_id, popularity: actorData.popularity });
          await castMember.save();
        }
        actorsIds.push({ actorid: castMember._id }); 
      }

      // -- GESTION DES GENRES (genres.js) --
      const genresIds = [];
      for (const genreData of (movie.Genres || [])) {
        let genre = await Genre.findOne({ tmdb_genre_id: genreData.tmdb_genre_id });
        if (!genre) {
          genre = new Genre({ name: genreData.name, tmdb_genre_id: genreData.tmdb_genre_id });
          await genre.save();
        }
        genresIds.push({ genreid: genre._id });
      }

      // -- GESTION DES COMPOSITEURS (composers.js) --
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

    // 4. Ajouter le film à l'utilisateur
    const isAlreadyInCollection = user.movies.some(
      (movieId) => movieId.toString() === existingMovie._id.toString()
    );

    if (isAlreadyInCollection) {
      return res.json({ result: false, error: 'Ce film est déjà dans votre collection' });
    }

    user.movies.push({
      movieid: existingMovie._id,
      isLoaned: false,
      isLiked: false
  });
  console.log(user.movies)
    await user.save();

    res.json({ result: true, message: 'Film ajouté avec succès !' });

  } catch (error) {
    console.error("Erreur critique :", error);
    res.json({ result: false, error: 'Erreur interne du serveur' });
  } 
});

module.exports = router;  

