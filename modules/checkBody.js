const User = require("../models/users");

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



module.exports = { checkBody, checkUsername};