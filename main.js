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
    error: function (error) {
      response.error(err.message);
    }
  });
});

Parse.Cloud.define("follow", function(request, response) {
  var sender = request.user;
  var followingId = request.params.followingId;
  var isFollow = request.params.isFollow;
  if (sender.id === followingId) {
    response.error(JSON.stringify({code: 105, message: "You cannot follow yourself!"}));
  }
  var fetchQuery = new Parse.Query(Parse.User);
  fetchQuery.get(followingId, {
    success: function(following) {
      var query = new Parse.Query(Parse.User);
      query.equalTo("following", following);
      query.equalTo("id", sender.id);

      query.first({
        success: function(user) {
          if(user) {
            response.error(JSON.stringify({code: 108, message: "You alredy follows this user"}));
          } else {
            if (isFollow) {
              sender.addUnique("following", following.id);
              following.addUnique("followers", sender.id);
            } else {
              sender.remove("following", following.id);
              following.remove("followers", sender.id);
            };

            sender.save(null, {
              useMasterKey: true,
              success: function() {
                console.log("Sender save ok");

                following.save(null, {
                  useMasterKey: true,
                  success: function() {
                    console.log("Following save ok");
                    response.success(sender);
                  },
                  error: function(object, error) {
                    console.log("Following save error: "+error.code+" "+error.message);
                    response.error(JSON.stringify({code: 106, message: "User save error"}));
                  }

                });
              },
              error: function(object, error) {
                console.log("Sender save error: "+error.code+" "+error.message);
                response.error(JSON.stringify({code: 106, message: "User save error"}));
              }
            });
          }
        },
        error: function(object, error) {
          console.log("error: "+error.code+" "+error.message);
          response.error(JSON.stringify({code: 107, message: "Action search error", error: error}));
        }
      });
    },
    error: function(object, error) {
          console.log("error: "+error.code+" "+error.message);
          response.error(JSON.stringify({code: 109, message: "Action search error", error: error}));
    } 
  });
});