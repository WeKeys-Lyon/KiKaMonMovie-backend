const Movie = require("../models/movies");
const User = require("../models/users");
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
    tmdb_director_id: element.id,
    popularity: element.popularity
    })});
    // Obtenir la liste des compositeurs
    let getComposers = api_data.credits.crew.filter(e => (e.job == "Original Music Composer" || e.job == "Music Director" || e.job == "Conductor" || e.job == "Orchestrator"));
    getComposers = [...new Map(getComposers.map(element => [element.name, element])).values()]
    let cleanComposers = [];
    getComposers.forEach(element => { cleanComposers.push({
    name: element.name,
    tmdb_composer_id: element.id,
    popularity: element.popularity
    })});
    // Obtenir la liste du casting
    let cleanCast = []
    api_data.credits.cast.forEach(element => { cleanCast.push({
    name: element.name,
    tmdb_actor_id: element.id,
    popularity: element.popularity
    })});
    // Obtenir la liste des Genres
    let cleanGenres = [];
    api_data.genres.forEach(element => { cleanGenres.push({
        name: element.name,
        tmdb_genre_id: element.id
    })    
    });
    //Obtenir l'affiche suivant le type de poster souhaité
    let afficheFr = '';
    const affiches = api_data.images?.posters?.filter((affiche) => affiche.iso_3166_1 == api_data.origin_country[0]).sort((a,b) => b.vote_average - a.vote_average);
    if (affiches[0]) {
        if (affiches[0].file_path) {
        afficheFr = affiches[0].file_path ? affiches[0]['file_path'] : '';
        }
    }
    
    return ({
        tmdb_id: api_data.id,
        original_title: api_data.original_title,
        title_fr: (titlefr) ? titlefr : api_data.original_title,
        release_date: api_data.release_date,
        poster_path: (afficheFr) ? afficheFr : api_data.poster_path,
        DirectedBy: cleanDirectors.sort((a,b) => b.popularity - a.popularity),
        Cast: cleanCast.sort((a,b) => b.popularity - a.popularity),
        MusicBy: cleanComposers.sort((a,b) => b.popularity - a.popularity),
        Genres: cleanGenres,
        popularity: api_data.popularity
    })
}

async function getMovieTreated(moviedata, poster_type) {

    // 🛡️ BOUCLIER 1 : Si on nous envoie du vide, on annule.
    if (!moviedata) return null;

    // 💡 L'ASTUCE EST ICI : On récupère l'ID selon d'où vient la donnée (BDD ou TMDB)
    const targetId = moviedata.movieid?.tmdb_id || moviedata.id;

    // 🛡️ BOUCLIER 2 : Si au final on n'a aucun ID valide, on annule.
    if (!targetId) return null;
    
    // On cherche d'abord dans notre base de données "Offline"
    const getMyMovieOffline = await Movie.findOne({ tmdb_id: targetId })
        .populate('DirectedBy.directorid')
        .populate('Cast.actorid')
        .populate('Genres.genreid')
        .populate('MusicBy.composerid');

    if (getMyMovieOffline) {
        if (moviedata.reviews?.length > 0) {
            for (let i = 0; i < moviedata.reviews.length; i++) {
                // 🚀 AJOUT DE L'AVATAR ICI POUR LA REVIEW PRINCIPALE
                const getUsername = await User.findOne({ _id: moviedata.reviews[i].userid }).select('username avatar _id');
                moviedata.reviews[i].userid = getUsername
                if (moviedata.reviews[i].replies.length > 0) {
                    for (let j = 0; j < moviedata.reviews[i].replies.length; j++) {
                    // 🚀 AJOUT DE L'AVATAR ICI POUR LES RÉPONSES
                    const getUsername = await User.findOne({ _id: moviedata.reviews[i].replies[j].userid }).select('username avatar _id');
                    moviedata.reviews[i].replies[j].userid = getUsername
                    }
                }
            }
        }
        const formattedOfflineMovie = {
            tmdb_id: getMyMovieOffline.tmdb_id,
            original_title: getMyMovieOffline.original_title,
            title_fr: getMyMovieOffline.title_fr,
            release_date: getMyMovieOffline.release_date ? new Date(getMyMovieOffline.release_date).toISOString().split('T')[0] : '',
            poster_path: getMyMovieOffline.poster_path,
            DirectedBy: getMyMovieOffline.DirectedBy.map(director => ({
                name: director.directorid?.name, popularity: director.directorid?.popularity 
            })),
            Cast: getMyMovieOffline.Cast.map(actor => ({
                name: actor.actorid?.name, popularity: actor.actorid?.popularity 
            })),
            Genres: getMyMovieOffline.Genres.map(genre => ({
                name: genre.genreid?.name 
            })),
            MusicBy: getMyMovieOffline.MusicBy.map(composer => ({
                name: composer.composerid?.name, popularity: composer.composerid?.popularity 
            })),
            isLoaned: moviedata.isLoaned || false,
            isLiked: moviedata.isLiked || false,
            pastLoans: moviedata.pastLoans || [],
            reviews: moviedata.reviews || [],
            isAsked: moviedata.isAsked || false,
            popularity: getMyMovieOffline.popularity || null
        };
        return formattedOfflineMovie;            
    } else {
        
        const moreInfosURL = `${base_API}3/movie/${targetId}?append_to_response=credits,translations,images`;
        const newResponse = await fetch(encodeURI(moreInfosURL), options_get);
        let moreInfos = await newResponse.json();

        if (moreInfos.status == "Released") {
            return (makeACard(moreInfos));
        }
        return null; 
    }            
}
module.exports = { makeACard, getMovieTreated };