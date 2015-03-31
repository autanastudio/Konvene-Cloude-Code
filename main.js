Parse.Cloud.define("authorize", function(request, response) {
  var klauth = require('cloud/klauth.js');
  var phoneNumber = request.params.phoneNumber;
  var verificationCode = request.params.verificationCode;
  klauth.getUserWithCode(phoneNumber, verificationCode, function(user, errJSON){
    if (user) {
      Parse.Cloud.useMasterKey();
      user.fetch({
        success: function (user) {
          response.success(user._sessionToken);
        },
        error: function (user, err) {
          response.error(err.message);
        }
      });
    } else {
      response.error(errJSON);
    }
  });
});
  
Parse.Cloud.define("requestCode", function(request, response) {
  var klauth = require("cloud/klauth.js");
  var phoneNumber = request.params.phoneNumber;
  klauth.requireCode(phoneNumber).then(function() {
    response.success();
  });
});

Parse.Cloud.define("checkUsersFromContacts", function(request, response) {
  var phonesArray = request.params.phonesArray;
  var query = new Parse.Query(Parse.User);
  query.containedIn("phoneNumber", phonesArray);
  query.equalTo("isRegistered", true);
  query.find({
    success: function (usersArray) {
      response.success(usersArray)
    },
    error: function (usersArray, error) {
      response.error(err.message);
    }
  });
});