var errors = require('cloud/errors.js');
var activity = require('cloud/activity.js');
var activityType = activity.activityType;

function setupUser(user, fullName, email, phoneNumber, facebookId, facebookFriendIds) {
  var promise = new Parse.Promise();
  user.set("fullName", fullName);
  user.set("email", email);
  user.set("facebookId", facebookId);
  if (!phoneNumber){
    user.set("phoneNumber", phoneNumber);
  }

  user.save(null, {useMasterKey: true}).then(function (user){
      var query = new Parse.Query(Parse.User);
      query.containedIn("facebookId", facebookFriendIds);
      query.each(function(friend) {
        activity.addActivity(activityType.KLActivityTypeFacebookFriendRegistered, user, friend, null).then(function () {
          console.log("Facebook user setup: Activity added for " + friend.get("fullName"));
        }, function (error) {
          console.log(error);
        });
      }).then(function(){
        promise.resolve(user);
      });
    }, function (error) {
      console.log(error);
      promise.reject(error);
    }
  );
  return promise;
}

module.exports = {
 setupUser: setupUser
};
