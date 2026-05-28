const Movie = require("../models/movies");

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
        title_fr: (titlefr) ? titlefr : api_data.title_original,
        release_date: api_data.release_date,
        poster_path: api_data.poster_path,
        DirectedBy: cleanDirectors,
        Cast: cleanCast,
        MusicBy: cleanComposers,
        genre: cleanGenres
    })
}
module.exports = { makeACard };