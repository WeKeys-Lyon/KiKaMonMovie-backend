var express = require('express');
var router = express.Router();
const TMDB_BEARER = process.env.TMDB_BEARER;
require('../models/connection');
const User = require('../models/users');

const base_API = `https://api.themoviedb.org/`
const options_get = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${TMDB_BEARER}`
  }
};

router.get('/search/:title', async (req, res) => {
    //Faire un appel à Mongoose pour enregistrer dans un Array la liste des tmdb_id présents dans la collection.

    const myUrl = `${base_API}3/search/movie?query=${req.params.title}`;

    const response = await fetch(encodeURI(myUrl), options_get);
    let data = await response.json();
    data.results.sort((a,b) => b.popularity - a.popularity);

    let myResults = [];

    const times = 10;
    for(let i = 0; i < times; i++){
        if (data.results[i]) {
            // Si le data.results[i].id match avec le tmdb_id, alors on skip les appels API pour prendre les données Mongoose.
            // https://api.themoviedb.org/3/movie/{movie_id} Avoir plus d'infos sur le film
            // https://api.themoviedb.org/3/movie/{movie_id}/credits Avoir le casting devant et derrière la caméra
            // https://api.themoviedb.org/3/movie/{movie_id}/translations avoir le titre en français
            // Faire trois appels 10 fois pour obtenir un affichage correct des résultats sur la page suivante
            myResults.push(data.results[i])
        }
    }
    res.status(200).send({result: true, answer : myResults});
});

module.exports = router;
