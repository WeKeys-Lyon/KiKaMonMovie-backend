var express = require('express');
var router = express.Router();
require('../models/connection');
const User = require('../models/users');
const Physical_format = require('../models/physical');
const Movie = require('../models/movies');
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
        res.status(400).send({result: false, answer : 'Missing parameters'});
        return;
    }
    const username = await User.findOne({username: req.body.mylogin});
    const email = await User.findOne({email: req.body.mylogin});
    let userExists = '';
    if (username) {
        userExists = username;
    } else if (email) {
        userExists = email;
    };
    if ( !bcrypt.compareSync(req.body.password, userExists.password) ) {
        res.status(400).send({result: false, answer : 'User not found or wrong password'});
        return;
    } else {
        (username) ? res.status(200).send({result: true, answer: { username: username.username, email: username.email, token: username.token }}) : res.status(200).send({result: true, answer: { username: email.username, email: email.email, token: email.token }})
    }
    
});

module.exports = router;  

