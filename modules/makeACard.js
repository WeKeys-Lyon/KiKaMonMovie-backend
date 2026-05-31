const Movie = require("../models/movies");
const TMDB_BEARER = process.env.TMDB_BEARER;
const base_API = `https://api.themoviedb.org/`
const options_get = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${TMDB_BEARER}`
  }
};

function makeACard(api_data) {
    // Obtenir le titre en Français
    const getTitleFR = api_data.translations.translations.find(e => e.iso_3166_1 === 'FR');
    const titlefr = (getTitleFR) ? getTitleFR.data.title : '';
    // Obtenir la liste des réalisateurs
    const getDirectors = api_data.credits.crew.filter(e => e.job == "Director");
    let cleanDirectors = []
    getDirectors.forEach(element => { cleanDirectors.push({
    name: element.name,
    tmdb_director_id: element.id
    })});
    // Obtenir la liste des compositeurs
    const getComposers = api_data.credits.crew.filter(e => (e.job == "Original Music Composer" || e.job == "Music Director"));
    let cleanComposers = [];
    getComposers.forEach(element => { cleanComposers.push({
    name: element.name,
    tmdb_composer_id: element.id
    })});
    // Obtenir la liste du casting
    let cleanCast = []
    api_data.credits.cast.forEach(element => { cleanCast.push({
    name: element.name,
    tmdb_actor_id: element.id
    })});
    // Obtenir la liste des Genres
    let cleanGenres = [];
    api_data.genres.forEach(element => { cleanGenres.push({
        name: element.name,
        tmdb_genre_id: element.id
    })    
    })
    return ({
        tmdb_id: api_data.id,
        original_title: api_data.original_title,
        title_fr: (titlefr) ? titlefr : api_data.original_title,
        release_date: api_data.release_date,
        poster_path: api_data.poster_path,
        DirectedBy: cleanDirectors,
        Cast: cleanCast,
        MusicBy: cleanComposers,
        genre: cleanGenres
    })
}

async function getMovieTreated(moviedata) {
            // Si le data.results[i].id match avec le tmdb_id, alors on skip les appels API pour prendre les données Mongoose.
            const getMyMovieOffline = await Movie.findOne({tmdb_id: moviedata.id})
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
              return formattedOfflineMovie;            
            } else {
              const moreInfosURL = `${base_API}3/movie/${moviedata.id}?append_to_response=credits,translations`;
              const newResponse = await fetch(encodeURI(moreInfosURL), options_get);
              let moreInfos = await newResponse.json();
              // On exclus tous les films qui ne sont pas sortis (exemple Toy Story 6 - id 1689447)
              if(moreInfos.status == "Released") {
                //Mise en forme pour la BDD
                return (makeACard(moreInfos))
              }
          
            }            
        }
module.exports = { makeACard, getMovieTreated };