var activity = require('cloud/activity.js');
var activityType = activity.activityType;

var parseApiUrl = "https://api.parse.com/1/jobs/";
var parseAppId = "MI3UHH01oU7RrLFjgCai5l1vCZpDHRz4xuIVPmcw";
var parseMasterKey = "VutRqNHi4LzqzsJhcvR0k7gHoD3Y6DiIXoeEmtsU";

var Activity = Parse.Object.extend("Activity");
var Event = Parse.Object.extend("Event");
var Invite = Parse.Object.extend("Invite");

//Call backgroundJob from REST API
var callBackgroundJob = function (job) {
    var promise = new Parse.Promise();
    Parse.Cloud.httpRequest({
        url: parseApiUrl + job.name,
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'X-Parse-Application-Id': parseAppId,
            'X-Parse-Master-Key': parseMasterKey,
        },
        body: job.body,
        success: function(httpResponse) {
            promise.resolve(httpResponse.text);
        },
        error: function(httpResponse) {
            promise.reject('Request failed with response code ' + httpResponse.status);
        }
    });
    return promise;
};

//Function for clean data after delete event
var cleanEventData = function (eventId) {
    Parse.Cloud.useMasterKey();
    var promise = new Parse.Promise();
    //Delete event from user createdEvents list
    var query = new Parse.Query(Parse.User);
    var event = new Event();
    event.id = eventId;
    query.equalTo("createdEvents", eventId);
    query.first().then(function (user) {
        if (user) {
            user.remove("createdEvents", eventId);
            return user.save();
        } else {
            return Parse.Promise.as();
        }
    }).then(function () {
        //Delete activity with null events
        var query = new Parse.Query(Activity);
        query.equalTo("event", event);
        query.notEqualTo("activityType", activityType.KLActivityTypeEventCanceled);
        return query.each(function (activity) {
            if (activity) {
                return activity.destroy();
            } else {
                return Parse.Promise.as();
            }
        });
    }).then(function () {
        //Delete invites with null events
        var query = new Parse.Query(Invite);
        query.equalTo("event", event);
        return query.each(function (invite) {
            if (invite) {
                return invite.destroy();
            } else {
                return Parse.Promise.as();
            }
        });
    }).then(function() {
        promise.resolve();
    }, function(error) {
        promise.reject(error);
    });
    return promise;
};

module.exports = {
  callBackgroundJob: callBackgroundJob,
  cleanEventData: cleanEventData,
};