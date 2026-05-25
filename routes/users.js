var express = require('express');
var router = express.Router();
require('../models/connection');
const User = require('../models/users');
const bcrypt = require('bcrypt');
const uid2 = require('uid2');

// inscription d'un nouvel utilisateur
router.post('/signup', async (req, res) => {
    const {username, password, email} = req.body;
   if (!username || !password || !email) {
    res.status(400).send({result: false, answer : 'Missing parameters'});
    return;
  }
    const userExists = await User.findOne({username: req.body.username});
    if (userExists) {
        res.status(400).send({result: false, answer : 'User not found'});
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
    res.status(201).send({result: true, answer : newUser});
},

//connexion d'un utilisateur déjà inscrit
router.post('/signin', async (req, res) => {
    const {username, password, email} = req.body;
    if (!username || !password) {
        res.status(400).send({result: false, answer : 'Missing parameters'});
        return;
    }
    const userExists = await User.findOne({username: req.body.username});
    if (!userExists || !bcrypt.compareSync(req.body.password, userExists.password)) {
        res.status(400).send({result: false, answer : 'User not found or wrong password'});
        return;
    }
    res.status(200).send({result: true, user: { username: user.username, email: user.email, token: user.token }});
}));

module.exports = router;  

