var errors = require('cloud/errors.js');
var activity = require('cloud/activity.js');
var activityType = activity.activityType;

var Event = Parse.Object.extend("Event");
var Invite = Parse.Object.extend("Invite");
var EventExtension = Parse.Object.extend("EventExtension");

//Add vote to event, value adds to event rating and event owner raiting
var vote = function (sender, value, eventId) {
  var promise = new Parse.Promise();
  var fetchQuery = new Parse.Query(Event);
  fetchQuery.include("extension");
  fetchQuery.get(eventId).then(function (event) {
    var owner = event.get("owner");
    var extension = event.get("extension");
    var voters = extension ? extension.get("voters") : null;
    if (owner.id === sender.id) {
      promise.reject(errors.errorVoteForMyEvent);
    } else if (voters && voters.indexOf(sender.id) !== -1) {
      promise.reject(errors.errorVoteTwice);
    } else {
      if (!extension) {
        extension = new EventExtension();
        event.set("extension", extension);
      }
      extension.addUnique("voters", sender.id);
      updateRaiting(value, extension);
      updateRaiting(value, owner);
      event.save(null, {useMasterKey : true}).then(function (event) {
        promise.resolve(event);
      },
      function (error) {
        console.log(error);
        promise.reject(errors.errorSaveObjectOnServer);
      });
    }
  });
  return promise;
};

//Update reainting for object
var updateRaiting = function (value, object) {
  var weight = [-2, -1, 0, 1, 2];
  var raiting = object.get("raiting");
  if (raiting) {
    raiting = raiting + weight[value];
  } else {
    raiting = weight[value];
  }
  object.set("raiting", raiting);
};

//Attend to event, delete if alredy attend
var attend = function (sender, eventId) {
  var promise = new Parse.Promise();
  var fetchQuery = new Parse.Query(Event);
  fetchQuery.include("price");
  fetchQuery.get(eventId).then(function (event) {
    var price = event.get("price");
    var pricingType = price.get('pricingType');
    var minimumAmount = price.get('minimumAmount');
    var privacy = event.get('privacy');
    if (pricingType === 0 || (pricingType===2 && minimumAmount === 0)) {
      var attendees = event ? event.get("attendees") : null;
      if (attendees && attendees.indexOf(sender.id) !== -1) {
        event.remove("attendees", sender.id);
        event.save().then(function (event) {
          promise.resolve(event);
        },
        function (error) {
          console.log(error);
          promise.reject(errors.errorSaveObjectOnServer);
        });
      } else {
        event.addUnique("attendees", sender.id);
        activity.addActivity(activityType.KLActivityTypeGoesToMyEvent, sender, event.get("owner"), event).then(function () {
          return activity.addActivity(activityType.KLActivityTypeGoesToEvent, sender, null, event);
        }).then(function () {
          promise.resolve(event);
        },
        function (error) {
          promise.reject(errors.errorSaveObjectOnServer);
        });
      }
    } else {
      promise.reject(errors.errorPayedEvent);
    }
  });
  return promise;
};

//Invite user to event
var invite = function (sender, invitedId, eventId, isInvite) {
  var promise = new Parse.Promise();
  //Crunch for old version support
  if (isInvite === undefined) {
    isInvite = 1;
  }
  if (sender.id === invitedId) {
    promise.reject(errors.errorInviteYourself);
  }
  var fetchQuery = new Parse.Query(Event);
  fetchQuery.get(eventId).then(function (event) {
    if (!event) {
      promise.reject(errors.errorWrongParameters);
    } else {
      return checkEventPermission(event, sender);
    }
  }).then(function (event) {
    return findInvite(event, sender, invitedId, isInvite).then(function (invite) {
      if (isInvite) {
        event.addUnique("invited", invitedId);
        return invite.save(null, {useMasterKey : true}).then(function () {
          return Parse.Promise.as(event);
        });
      } else {
        event.remove("invited", invitedId);
        return invite.destroy({useMasterKey : true}).then(function () {
          return event.save(null, {useMasterKey : true});
        });
      }
    });
  }).then(function (event) {
    promise.resolve(event);
  },
  function (error) {
    promise.reject(error);
  });
  return promise;
}

//Check event permission (private, private+)
var checkEventPermission = function (event, user) {
  var privacyType = event.get("privacy");
  var owner = event.get("owner");
  var invited = event ? event.get("invited") : null;
  if (privacyType === 2 && !((invited && invited.indexOf(user.id) !== -1) || (owner.id === user.id))) {
    return Parse.Promise.error(errors.errorWrongPermission);
  } else if (privacyType === 1 && owner.id !== user.id) {
    return Parse.Promise.error(errors.errorWrongPermission);
  } else {
    return Parse.Promise.as(event);
  }
}

//Find invite, check state for isInvite status, 
var findInvite = function (event, from, toId, isInvite) {
  var query = new Parse.Query(Invite);
  var to = new Parse.User();
  to.id = toId;
  query.equalTo('to', to);
  query.equalTo('event', event);
  return query.first().then(function (invite) {
    if (isInvite) {
      if (invite) {
        return Parse.Promise.error(errors.errorInviteTwice);
      } else {
        //Cranch for show badge on tab, when you are invited
        to.set("invited", 1);
        invite = new Invite();
        invite.set('from', from);
        invite.set('to', to);
        invite.set('event', event);
        invite.set('status', 0);
        return Parse.Promise.as(invite);
      }
    } else {
      if (invite) {
        return Parse.Promise.as(invite);
      } else {
        return Parse.Promise.error(errors.errorInviteDoesntExist);
      }
    }
  });
};

//Call methode for update created events list, and add activity for crete event
var updateCreatedEvents = function (event) {
  var owner = event.get("owner");
  owner.addUnique("createdEvents", event.id);
  owner.save(null, {useMasterKey: true}).then(function (user){
    if (event.get('privacy') === 0) {
      return owner.fetch();
    } else {
      return Parse.Promise.as();
    }
  }).then(function (user) {
    if (user) {
      activity.addActivity(activityType.KLActivityTypeCreateEvent, user, null, event).then(function () {
      }, function (error) {
        console.log(error);
      });
    }
  }, 
  function (error) {
    console.log(error);
  });
}

module.exports = {
  vote: vote,
  attend: attend,
  invite: invite,
  updateCreatedEvents: updateCreatedEvents,
};