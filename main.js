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

Parse.Cloud.beforeSave("FollowAction", function(request, response) {
  var fromUser = request.object.get("from");
  var toUser = request.object.get("to");
  var sender = request.user;
  if (fromUser.id === toUser.id) {
    response.error(JSON.stringify({code: 105, message: "You cannot follow yourself!"}));
  }
  if (fromUser.id === sender.id) {
    var actionQuery = new Parse.Query("FollowAction");
    actionQuery.equalTo("from", fromUser);
    actionQuery.equalTo("to", toUser);
    actionQuery.first({
      success: function(action) {
        if(action) {
          response.error(JSON.stringify({code: 108, message: "You alredy follows this user"}));
        } else {
          response.success();
        }
      },
      error: function(error) {
        console.log("error: "+error.code+" "+error.message);
        response.error(JSON.stringify({code: 107, message: "Action search error", error: error}));
      }
    });
  } else {
    response.error(JSON.stringify({code: 106, message: "You doesn't have permissions for that action!"}));
  }
});

Parse.Cloud.beforeDelete("FollowAction", function(request, response) {
  var fromUser = request.object.get("from");
  var toUser = request.object.get("to");
  var sender = request.user;
  if (fromUser.id === sender.id) {
    response.success();
  } else {
    response.error(JSON.stringify({code: 106, message: "You doesn't have permissions for that action!"}));
  }
});

Parse.Cloud.afterSave("FollowAction", function(request) {
  var fromUser = request.object.get("from");
  var toUser = request.object.get("to");
  updateUserCount(fromUser, "from", "followingCount");
  updateUserCount(toUser, "to", "followerCount");
});

Parse.Cloud.afterDelete("FollowAction", function(request) {
  var fromUser = request.object.get("from");
  var toUser = request.object.get("to");
  updateUserCount(fromUser, "from", "followingCount");
  updateUserCount(toUser, "to", "followerCount");
});

var updateUserCount = function(user, userKey, countKey) {
  var followersQuery = new Parse.Query("FollowAction");
  followersQuery.equalTo(userKey, user);
  followersQuery.find({
    success: function (results) {
      user.set(countKey, results.length);
      user.save(null, {
        useMasterKey: true,
        success: function() {
          console.log("User save ok");
        },
        error: function(cs, error) {
          console.log("User save error: "+error.code+" "+error.message);
        }
      });
    },
    error: function (results, error) {
      console.log(error.message);
    }
  });
};