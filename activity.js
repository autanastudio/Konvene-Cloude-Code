var moment = require('cloud/moment');
var errors = require('cloud/errors.js');

var Activity = Parse.Object.extend("Activity");

var activityType = {
  KLActivityTypeFollowMe :                    0,
  KLActivityTypeFollow :                      1,
  KLActivityTypeCreateEvent :                 2,
  KLActivityTypeGoesToEvent :                 3,
  KLActivityTypeGoesToMyEvent :               4,
  KLActivityTypeEventCanceled :               5,
  KLActivityTypeEventChangedName :            6,
  KLActivityTypeEventChangedLocation :        7,
  KLActivityTypeEventChangedTime :            8,
  KLActivityTypePhotosAdded :                 9,
  KLActivityTypeCommentAdded :                10,
  KLActivityTypePayForEvent :                 11,
  KLActivityTypeCommentAddedToAttendedEvent : 12,
}

var addActivity = function (type, from, to, event) {
  Parse.Cloud.useMasterKey();
  var activityController = {
    type : type,
    from : from,
    to : to,
    event : event
  };
  var promise = new Parse.Promise;
  var findActivityPromise = Parse.Promise.as();
  if (isGroupedActivity(type)) {
    var query = buildGroupedActivityQuery(activityController);
    findActivityPromise = query.first();
  }
  findActivityPromise.then(function (activity) {
    if (!activity) {
      var activity = buildActivity(activityController);
    }
    updateObservers(activity, activityController);
    if (type == activityType.KLActivityTypeFollowMe) {
      activity.addUnique("users", from);
    } else if (type == activityType.KLActivityTypeFollow) {
      activity.addUnique("users", to);
    } else if (type == activityType.KLActivityTypeGoesToMyEvent) {
      activity.addUnique("users", from);
    }
    activity.save().then(function (activity) {
      promise.resolve(activity);
    },
    function (error) {
      console.log(error);
      promise.reject(errors.errorSaveObjectOnServer);
    });
  });
  return promise;
};

var isGroupedActivity = function (type) {
  switch (type) {
    case activityType.KLActivityTypeFollowMe:
    case activityType.KLActivityTypeFollow:
    case activityType.KLActivityTypeGoesToMyEvent:
    return true;
    case activityType.KLActivityTypeCreateEvent:
    case activityType.KLActivityTypeGoesToEvent:
    case activityType.KLActivityTypeEventCanceled:
    case activityType.KLActivityTypePayForEvent:
    default:
    return false;
  };
};

var buildActivity = function (activityController) {
  activity = new Activity();
  activity.set("activityType", activityController.type);
  activity.set("from", activityController.from);
  if (activityController.event) {
    activity.set("deletedEventTitle", activityController.event.get("title"));
    activity.set("event", activityController.event);
  }
  return activity;
};

var updateObservers = function (activity, activityController) {
  switch (activityController.type) {
    case activityType.KLActivityTypeFollowMe:
    case activityType.KLActivityTypeGoesToMyEvent:
    case activityType.KLActivityTypePayForEvent:
      activity.addUnique("observers", activityController.to.id);
    break;
    case activityType.KLActivityTypeFollow:
      var observers = activityController.from.get("followers");
      if (observers) {
        var index = observers.indexOf(activityController.to.id);
        if (index != -1) { 
          observers.splice(index, 1);
        }
        activity.set("observers", observers);
      }
    break;
    case activityType.KLActivityTypeCreateEvent:
      oldActivity.set("observers", activityController.from.get("followers"));
    break;
    case activityType.KLActivityTypeGoesToEvent:
      var ownerId = activityController.event.get('owner').id;
      if (observers) {
        var index = observers.indexOf(ownerId);
        if (index != -1) { 
          observers.splice(index, 1);
        }
        activity.set("observers", observers);
      }
    break;
    case activityType.KLActivityTypeEventCanceled:
      var attendees = activityController.event.get("attendees");
      var savers = activityController.event.get("savers");
      if (attendees && savers) {
        activity.set("observers", attendees.concat(savers));
      } else if (attendees) {
        activity.set("observers", attendees);
      } else if (savers) {
        activity.set("observers", savers);
      }
    break;
    default:
    break;
  };
};

var buildGroupedActivityQuery = function (activityController) {
  var query = new Parse.Query(Activity);
  query.equalTo("activityType", activityController.type);
  query.greaterThan("createdAt", moment().subtract(1, 'd').toDate());
  if (activityController.type == activityType.KLActivityTypeFollowMe) {
    query.equalTo("observers", activityController.to.id);
  } else if (activityController.type == activityType.KLActivityTypeFollow) {
    query.equalTo("from", activityController.from);
  } else if (activityController.type == activityType.KLActivityTypeGoesToMyEvent) {
    query.equalTo("observers", activityController.to.id);
    query.equalTo("event", activityController.event); 
  } else {
    //Returm query null if it isn't grouped
    return null;
  }
  return query;
};

module.exports = {
  activityType: activityType,
  addActivity: addActivity,
};