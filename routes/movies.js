var express = require('express');
var router = express.Router();
const TMDB_BEARER = process.env.TMDB_BEARER;
require('../models/connection');
const User = require('../models/users');
const Movie = require('../models/movies');
const mongoose = require('mongoose');
const {makeACard, getMovieTreated} = require('../modules/makeACard');

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
        const midResult = await getMovieTreated(data.results[i])
        if (midResult) {
          myResults.push(midResult)
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
    dataPerson.results.sort((a,b) => b.popularity - a.popularity)
    const personID = dataPerson.results[0].id;

    const detailsUrl = `${base_API}3/person/${personID}/movie_credits`;
    const responseDetails = await fetch(encodeURI(detailsUrl), options_get); 
    let dataDetails = await responseDetails.json();
    // new Date(getMyMovieOffline.release_date).toISOString().split('T')[0]

    
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
    // Filtrage pour sortir les films qui sont dans le futur
    results = results.filter((film) => (new Date(film.release_date).getTime() / 1000) < (new Date().getTime() / 1000))
    res.status(200).send({result: true, answer: results, people: dataPerson.results[0].name})

    }
});

router.get('/searchid/:id', async (req, res) => {
    const myResults = await getMovieTreated({id: req.params.id});

    (myResults) ? res.status(200).send({result: true, answer: myResults}) : res.status(200).send({result: false, error: 'Rien n a fonctionné'})
});

router.get('/searchean/:id', async (req, res) => {
  if (req.params.id) {

    const myURL = `http://gapi.wekeys.fr:7000/mega/search?engines=duckduckgo&text=${req.params.id}&limit=2`;
    console.log(myURL)
    const response = await fetch(encodeURI(myURL));
    const data = await response.json();
    
    (data.results) ? res.status(200).send({result: true, answer: data.results[0].title.toString()}) : res.status(200).send({result: false, error: 'La recherche n\'a rien donné'});
  } else {
    res.status(200).send({result: false, error: 'Manque le paramètre ID req.params.id'});
  }
})

module.exports = router;
