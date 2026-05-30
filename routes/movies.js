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
    const myUrl = `${base_API}3/search/movie?query=${req.params.title}`;

    const response = await fetch(encodeURI(myUrl), options_get);
    let data = await response.json();
    data.results.sort((a,b) => b.popularity - a.popularity);
    if (!data.total_results) {
      res.status(200).send({result: false, error: 'Aucun resultat retourné'});
      return;
    }
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
            } else {
              const moreInfosURL = `${base_API}3/movie/${data.results[i].id}?append_to_response=credits,translations`;
              const newResponse = await fetch(encodeURI(moreInfosURL), options_get);
              let moreInfos = await newResponse.json();
              // On exclus tous les films qui ne sont pas sortis (exemple Toy Story 6 - id 1689447)
              if(moreInfos.status == "Released") {
                //Mise en forme pour la BDD
                myResults.push(makeACard(moreInfos))
              }
          
            }            
        }
    }
    (myResults) ? res.status(200).send({result: true, answer : myResults}) : res.status(200).send({result: false, error: 'Aucun resultat retourné'})
    
});

router.get('/searchpeople/:people', async (req, res) => {
    const myPersonUrl = `${base_API}3/search/person?query=${req.params.people}`;

    const responsePerson = await fetch(encodeURI(myPersonUrl), options_get);
    let dataPerson = await responsePerson.json();
        if (dataPerson.total_results == 0) {
        res.status(200).send({result: false, error: 'Pas de personnalité trouvé.'});
        return;
    }
    const personID = dataPerson.results[0].id;

    const detailsUrl = `${base_API}3/person/${personID}/movie_credits`;
    const responseDetails = await fetch(encodeURI(detailsUrl), options_get); 
    let dataDetails = await responseDetails.json();

    if (dataDetails.crew.length && dataDetails.cast.length) {
        const map = new Map([...dataDetails.crew, ...dataDetails.cast]
            .map(obj => [obj.id, obj]));
        const mergedArray = Array.from(map.values());
        let results = [];
        mergedArray.forEach(e => results.push({
          tmdb_id: e.id,
          original_title: e.original_title,
          poster_path: e.poster_path,
          release_date: e.release_date
        }))
    res.status(200).send({result: true, answer: results})

    }
});

router.get('/searchid/:id', async (req, res) => {
    
});

module.exports = router;
