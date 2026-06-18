const User = require("../models/users");
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function checkBody(object, tableau) {
  let count = 0
  tableau.forEach(element => {
    if (object[element]) {count++}
  });
    if (count == tableau.length) {
        return true;
    } else {
        return false;
    }
}

function checkEmail(email) {
  return EMAIL_REGEX.test(email);
}


function checkUsername(username) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(User.findOne({username: username}).then(data =>  {
    if (data == null) {
        return false
    } else {
        return true
    }
   }));
    }, 1000);
  });
}

// modules/checkPassword.js

function checkPassword(password) {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
  return passwordRegex.test(password);
}

module.exports = { checkPassword };



module.exports = { checkBody, checkUsername, checkEmail };