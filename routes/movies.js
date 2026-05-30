var express = require('express');
var router = express.Router();
const TMDB_BEARER = process.env.TMDB_BEARER;
require('../models/connection');
const User = require('../models/users');
const Movie = require('../models/movies');
const mongoose = require('mongoose');
const {makeACard} = require('../modules/makeACard');

const base_API = `https://api.themoviedb.org/`
const options_get = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${TMDB_BEARER}`
  }
};

router.get('/search/:title', async (req, res) => {
    // TODO : Que faire si recherche vide ?
    const myUrl = `${base_API}3/search/movie?query=${req.params.title}`;

    const response = await fetch(encodeURI(myUrl), options_get);
    let data = await response.json();
    data.results.sort((a,b) => b.popularity - a.popularity);

    let myResults = [];

    const times = 10;
    for(let i = 0; i < times; i++){
        if (data.results[i]) {
            // Si le data.results[i].id match avec le tmdb_id, alors on skip les appels API pour prendre les données Mongoose.
            const getMyMovieOffline = await Movie.findOne({tmdb_id: data.results[i].id})
              .populate('DirectedBy.directorid')
              .populate('Cast.actorid')
              .populate('Genres.genreid')
              .populate('MusicBy.composerid');
            if (getMyMovieOffline) {
              const formattedOfflineMovie = {
                tmdb_id: getMyMovieOffline.tmdb_id,
                original_title: getMyMovieOffline.original_title,
                title_fr: getMyMovieOffline.title_fr,
                release_date: getMyMovieOffline.release_date ? new Date(getMyMovieOffline.release_date).toISOString().split('T')[0] : '',
                poster_path: getMyMovieOffline.poster_path,
                DirectedBy: getMyMovieOffline.DirectedBy.map(director => ({
                  name: director.directorid?.name })),
                Cast: getMyMovieOffline.Cast.map(actor => ({
                  name: actor.actorid?.name })),
                  Genres: getMyMovieOffline.Genres.map(genre => ({
                  name: genre.genreid?.name })),
                  MusicBy: getMyMovieOffline.MusicBy.map(composer => ({
                  name: composer.composerid?.name }))

              };
              myResults.push(formattedOfflineMovie);
            //if (TMDBIds.find(e => e.tmdb_id == data.results[i].id)) {
            
            } else {
              const moreInfosURL = `${base_API}3/movie/${data.results[i].id}?append_to_response=credits,translations`;
              const newResponse = await fetch(encodeURI(moreInfosURL), options_get);
              let moreInfos = await newResponse.json();

              //Mise en forme pour la BDD
              myResults.push(makeACard(moreInfos))
              
              
            }            
        }
    }
    res.status(200).send({result: true, answer : myResults});
});

module.exports = router;
