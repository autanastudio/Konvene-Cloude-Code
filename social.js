var errors = require('cloud/errors.js');
var activity = require('cloud/activity.js');
var activityType = activity.activityType;

var follow = function (sender, followingId, isFollow) {
  var promise = new Parse.Promise();
  if (sender.id === followingId) {
    promise.reject(errors.errorFollowYourself);
  }
  var followingUser = new Parse.User;
  followingUser.id = followingId;
  followingUser.fetch().then(function (following) {

  });
  var fetchQuery = new Parse.Query(Parse.User);
  var following;
  return fetchQuery.get(followingId).then(function (user) {
    following = user;
    var query = new Parse.Query(Parse.User);
    query.equalTo("following", user.id);
    query.equalTo("id", sender.id);
    return query.first();
  }).then(function (user) {
    if(user) {
      promise.reject(errors.errorAlredyFollowThisUser);
    } else {
      if (isFollow) {
        return doFollow(sender, following);
      } else {
        return unFollow(sender, following);
      }
    }
  });
};
 
var unFollow = function (sender, following) {
  Parse.Cloud.useMasterKey();
  sender.remove("following", following.id);
  following.remove("followers", sender.id);
  return following.save ().then(function (user) {
    return sender.save();
  });
};

var doFollow = function (sender, following) {
  sender.addUnique("following", following.id);
  following.addUnique("followers", sender.id);
  return activity.addActivity(activityType.KLActivityTypeFollowMe, sender, following).then(function () {
    return activity.addActivity(activityType.KLActivityTypeFollow, sender, following);
  });
};

module.exports = {
  follow: follow,
};