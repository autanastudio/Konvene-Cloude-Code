var errors = require('cloud/errors.js');
var klauth = require('cloud/klauth.js');
var social = require('cloud/social.js');
var events = require('cloud/events.js');
var background = require('cloud/background.js');
var Image = require("parse-image");
var activity = require('cloud/activity.js');
var facebook = require('cloud/facebook.js');

var activityType = activity.activityType;
var Invite = Parse.Object.extend("Invite");
var EventExtension = Parse.Object.extend("EventExtension");
var Activity = Parse.Object.extend("Activity");
var UserVenmo = Parse.Object.extend("UserVenmo");
//---
//---
//---
//!!! Cloud functions
//---
//---
//---

Parse.Cloud.define("authorize", function (request, response) {
  var phoneNumber = request.params.phoneNumber;
  var verificationCode = request.params.verificationCode;
  klauth.getUserWithCode(phoneNumber, verificationCode).then(function (user) {
    return user.fetch({useMasterKey : true});
  }).then(function (user) {
    response.success(user.getSessionToken());
  },function (error) {
    response.error(error);
  });
});

Parse.Cloud.define("authorizeWithFacebook", function (request, response) {
  var user = request.user;
  var fullName = request.params.fullName;
  var email = request.params.email;
  var phoneNumber = request.params.phoneNumber;
  var facebookId = request.params.facebookId;
  var facebookFriendIds = request.params.facebookFriendIds;

  facebook.setupUser(user, fullName, email, phoneNumber, facebookId, facebookFriendIds).then(function (user) {
    response.success(user);
  }, function (error) {
    response.error(error);
  });
});

Parse.Cloud.define("requestCode", function(request, response) {
  var phoneNumber = request.params.phoneNumber;
  klauth.requireCode(phoneNumber).then(function() {
    response.success();
  }, function (error) {
    response.error(error);
  });
});

Parse.Cloud.define("deleteUser", function(request, response) {
  var sender = request.user;
  sender.set('isDeleted', 1);
  sender.save(null, {
    useMasterKey: true,
    success: function() {
      response.success(sender);
    },
    error: function(object, error) {
      console.log("Save user error: "+error.code+" "+error.message);
      response.error(errors.errorDeleteUser);
    }
  });
});

Parse.Cloud.define("follow", function(request, response) {
  var sender = request.user;
  var followingId = request.params.followingId;
  var isFollow = request.params.isFollow;
  social.follow(sender, followingId, isFollow).then(function (newSender) {
    response.success(newSender);
  },
  function (error) {
    response.error(errors.errorFollowUserError);
  });
});

Parse.Cloud.define("vote", function(request, response) {
  var sender = request.user;
  var value = request.params.voteValue;
  var eventId = request.params.eventId;
  events.vote(sender, value, eventId).then(function (event) {
    response.success(event);
  },
  function (error) {
    response.error(error);
  });
});

Parse.Cloud.define("invite", function(request, response) {
  var sender = request.user;
  var invitedId = request.params.invitedId;
  var eventId = request.params.eventId;
  var isInvite = request.params.isInvite;
  events.invite(sender, invitedId, eventId, isInvite).then(function (event) {
    response.success(event);
  },
  function (error) {
    response.error(error);
  });
});

Parse.Cloud.define("attend", function(request, response) {
  var sender = request.user;
  var eventId = request.params.eventId;
  events.attend(sender, eventId).then(function (event) {
    response.success(event);
  },
  function (error) {
    response.error(error);
  });
});

//TODO rewrite old code
Parse.Cloud.define("addCard", function(request, response)
{
  var klpayment = require('cloud/klpayment.js');
  var owner = request.user;
  var source = request.params.token;
  klpayment.addCard(owner, source, function(paymentInfo, errorMessage){
    if (errorMessage) {
      response.error(JSON.stringify({code:111, message: errorMessage}));
    } else {
      owner.set("paymentInfo", paymentInfo);
      owner.save(null, {
        useMasterKey: true,
        success: function() {
          console.log("Save payment info ok");
          response.success(paymentInfo);
        },
        error: function(object, error) {
          console.log("Save payment info error: "+error.code+" "+error.message);
          response.error(JSON.stringify({code: 106, message: "PaymentInfo save error"}));
        }
      });
    }
  });
});

Parse.Cloud.define("assocVenmoInfo", function(request, response)
{
  var token = request.params.accessToken;
  var refreshToken = request.params.refreshToken;
  var venmoUserID = request.params.userID;
  var venmoUsername = request.params.username;

  // console.log("test assoc "+token+" : "+venmoUserID);

  var userVenmo = new UserVenmo();
  userVenmo.set("accessToken", token);
  userVenmo.set("refreshToken", refreshToken);
  userVenmo.set("userID", venmoUserID);
  userVenmo.set("username", venmoUsername);
  userVenmo.save(null, {
    useMasterKey: true,
    success: function(savedVenmo) {
      console.log("saved venmo info OK "+JSON.stringify(savedVenmo));
      response.success(savedVenmo);
    },
    error: function(object, error) {
      console.log("Save venmo info error: "+error.code+" "+error.message);
      response.error(JSON.stringify({code: 106, message: "venmoInfo save error"}));
    }
  });
});

Parse.Cloud.define("authStripeConnect", function(request, response)
{
  var klpayment = require('cloud/klpayment.js');
  var owner = request.user;
  var code = request.params.code;
  klpayment.authorizeWithStripeConnect(owner, code, function(user, errorMessage){
    if (errorMessage) {
      response.error(JSON.stringify({code:111, message: errorMessage}));
    } else {
      user.save(null, {
        useMasterKey: true,
        success: function() {
          console.log("Save user ok");
          response.success(user);
        },
        error: function(object, error) {
          console.log("Save user error: "+error.code+" "+error.message);
          response.error(JSON.stringify({code: 106, message: "User save error"}));
        }
      });
    }
  });
});

Parse.Cloud.define("deleteCard", function(request, response)
{
  var klpayment = require('cloud/klpayment.js');
  var owner = request.user;
  var cardId = request.params.cardId;
  klpayment.removeCard(owner, cardId, function(paymentInfo, errorMessage){
    if (errorMessage) {
      response.error(JSON.stringify({code:111, message: errorMessage}));
    } else {
      response.success(paymentInfo);
    }
  });
});

Parse.Cloud.define("buyVenmoTickets", function(request, response)
{
  var klpayment = require('cloud/klpayment.js');
  var owner = request.user;
  var payValue = request.params.payValue;
  var eventId = request.params.eventId;

  var fetchQuery = new Parse.Query(Parse.Object.extend("Event"));
  fetchQuery.include("price");
  fetchQuery.include("owner");
  fetchQuery.get(eventId, {
    success: function(eventObject) {
      var price = eventObject.get("price");
      var pricingType = price.get('pricingType');
      if (pricingType !== 1) {
        console.log("Wrong payment type");
        response.error(JSON.stringify({code: 111, message: "Wrong payment type"}));
      } else {
        var soldTickets = price.get("soldTickets");
        var maximumTickets = price.get("maximumTickets");
        if (soldTickets+payValue > maximumTickets) {
          console.log("This event sold out: "+error.code+" "+error.message);
          response.error(JSON.stringify({code: 112, message: "Event sold out"}));
        } else {
          var amount = payValue * price.get("pricePerPerson");
          klpayment.venmoPayment(owner, eventObject.get("owner"), amount, function(newCharge, errorMessage){
            if (errorMessage) {
              if (errorMessage == "no linked accounts") {
                response.error(JSON.stringify({code:113, message: errorMessage}));
              } else {
                response.error(JSON.stringify({code:111, message: errorMessage}));
              }
            } else {
              newCharge.set('event', eventObject);
              var price = eventObject.get('price');
              price.addUnique("payments", newCharge);

              if (soldTickets) {
                soldTickets = soldTickets + payValue;
              } else {
                soldTickets = payValue;
              }
              price.set("soldTickets", soldTickets);
              eventObject.set("price", price);
              eventObject.addUnique("attendees", owner.id);
              eventObject.save(null, {
                useMasterKey: true,
                success: function() {
                  activity.addActivity(activityType.KLActivityTypePayForEvent, owner, eventObject.get("owner"), eventObject).then(function () {
                    response.success(eventObject);
                  },
                  function (error) {
                    response.error(error);
                  });
                },
                error: function(object, error) {
                  console.log("Event save error: "+error.code+" "+error.message);
                  response.error(JSON.stringify({code: 106, message: "Event save error"}));
                }
              });
            }
          });
        }
      }
    },
    error: function(object, error) {
      console.log("error: "+error.code+" "+error.message);
      response.error(JSON.stringify({code: 109, message: "Event fetch error", error: error}));
    }
  });
});

Parse.Cloud.define("throwInVenmo", function(request, response)
{
  var klpayment = require('cloud/klpayment.js');
  var owner = request.user;

  var payValue = request.params.payValue;
  var eventId = request.params.eventId;
  var fetchQuery = new Parse.Query(Parse.Object.extend("Event"));
  fetchQuery.include("price");
  fetchQuery.include("owner");
  fetchQuery.get(eventId, {
    success: function(eventObject) {
      var price = eventObject.get("price");
      var pricingType = price.get('pricingType');
      if (pricingType !== 2) {
        console.log("Wrong payment type");
        response.error(JSON.stringify({code: 111, message: "Wrong payment type"}));
      } else {
        var minimumAmount = price.get("minimumAmount");
        if (payValue < minimumAmount) {
          console.log("You should pay more for this event");
          response.error(JSON.stringify({code: 112, message: "You should pay more for this event"}));
        } else {
          klpayment.venmoPayment(owner, eventObject.get("owner"), payValue, function(newCharge, errorMessage){
            if (errorMessage) {
              response.error(JSON.stringify({code:111, message: errorMessage}));
            } else {
              newCharge.set('event', eventObject);
              var price = eventObject.get('price');
              price.addUnique("payments", newCharge);

              var gathered = price.get("throwIn");
              if (gathered) {
                gathered = gathered + payValue;
              } else {
                gathered = payValue;
              }
              price.set("throwIn", gathered);
              eventObject.set("price", price);
              eventObject.addUnique("attendees", owner.id);
              eventObject.save(null, {
                useMasterKey: true,
                success: function() {
                  activity.addActivity(activityType.KLActivityTypePayForEvent, owner, eventObject.get("owner"), eventObject).then(function () {
                    response.success(eventObject);
                  },
                  function (error) {
                    response.error(error);
                  });
                },
                error: function(object, error) {
                  console.log("Event save error: "+error.code+" "+error.message);
                  response.error(JSON.stringify({code: 106, message: "Event save error"}));
                }
              });
            }
          });
        }
      }
    },
    error: function(object, error) {
      console.log("error: "+error.code+" "+error.message);
      response.error(JSON.stringify({code: 109, message: "Event fetch error", error: error}));
    }
  });
});

//---
//---
//---
//!!! Trigers
//---
//---
//---

Parse.Cloud.afterSave("Event", function(request) {
  //Add new event to createdEvents list for user
  if (request.object.existed() === false) {
    events.updateCreatedEvents(request.object);
  }
});

// crop user image before save profile
Parse.Cloud.beforeSave(Parse.User, function(request, response) {
  var user = request.object;
  if (!user.dirty("userImage") || !user.get("userImage")) {
    // The profile photo isn't being modified.
    response.success();
    return;
  }
  Parse.Cloud.httpRequest({
    url: user.get("userImage").url()
  }).then(function(response) {
    var image = new Image();
    return image.setData(response.buffer);
  }).then(function(image) {
    var size = Math.min(image.width(), image.height());
    return image.crop({
      left: (image.width() - size) / 2,
      top: (image.height() - size) / 2,
      width: size,
      height: size
    });

  }).then(function(image) {
    return image.scale({
      width: 64,
      height: 64
    });

  }).then(function(image) {
    return image.setFormat("JPEG");
  }).then(function(image) {
    return image.data();
  }).then(function(buffer) {
    var base64 = buffer.toString("base64");
    var cropped = new Parse.File("thumbnail.jpg", { base64: base64 });
    return cropped.save();

  }).then(function(cropped) {
    user.set("userImageThumbnail", cropped);
  }).then(function(result) {
    response.success();
  }, function(error) {
    response.error(error);
  });
});

Parse.Cloud.afterSave(Parse.User, function(request) {
  if (request.object.existed() !== false) {
    var owner = request.object;
    var query = new Parse.Query(Parse.Object.extend("Event"));
    query.containedIn("objectId", owner.get("createdEvents"));
    query.include("price");
    query.find({
      success: function(events) {
        for (var i = 0; i < events.length; i++) {
          var event = events[i];
          var price = event.get("price");
          var pricingType = price.get('pricingType');
          if (pricingType === 1 || pricingType === 2) {
            if (owner.get("stripeId") === "") {
              event.set("hide", 1);
            } else {
              event.set("hide", 0);
            }
            event.save(null, {
              useMasterKey: true,
              success: function() {
              },
              error: function(object, error) {
                console.log("Save event error: "+error.code+" "+error.message);
              }
            });
          }
        }
      },
      error: function(error) {
        alert("Error: " + error.code + " " + error.message);
      }
    });
  }
});

Parse.Cloud.afterDelete("Event", function(request) {
  var event = request.object;
  var owner = event.get("owner");
  var job = {
    name: "cleanEventData",
    body: {eventId: request.object.id},
  };
  background.callBackgroundJob(job).then( function () {
    return activity.addActivity(activityType.KLActivityTypeEventCanceled, owner, null, event);
  }).then( function () {
  },
  function (error) {
    console.log(error);
  });
});

Parse.Cloud.afterDelete(Parse.User, function(request) {
  Parse.Cloud.useMasterKey();
  var user = request.object;
  var followersQuery = new Parse.Query(Parse.User);
  followersQuery.equalTo("followers", user.id);
  followersQuery.each(function(follower) {
    follower.remove("followers", user.id);
    return follower.save();
  }).then(function() {

  }, function(error) {
    console.log(error);
  });
  var followingQuery = new Parse.Query(Parse.User);
  followingQuery.equalTo("following", user.id);
  followingQuery.each(function(follower) {
    follower.remove("following", user.id);
    return follower.save();
  }).then(function() {

  }, function(error) {
    console.log(error);
  });
});

Parse.Cloud.afterSave("Invite", function(request) {

  var query = new Parse.Query(Parse.Installation);

  var fetchQuery = new Parse.Query(Invite);
  fetchQuery.include("from");
  fetchQuery.include("event");
  fetchQuery.include("to");
  fetchQuery.get(request.object.id, {
    success: function(invite) {

      query.equalTo("user", invite.get("to").id);

      messageText = invite.get("from").get("fullName") + " invited you to " + invite.get("event").get("title") + ".";
      console.log(messageText);

      var body = {
          alert: messageText,
          badge: "Increment"
        };
      var event = invite.get('event');
      if (event) {
        body.eventId = event.id;
      }
      Parse.Push.send({
        where: query,
        data: body
      }, {
        success: function() {
          console.log("Send push successfuly!");
        },
        error: function(error) {
          console.log("Push notification error");
          console.log(error);
        }
      });
    },
    error: function(object, error) {
      console.log("error: "+error.code+" "+error.message);
    }
  });
});

Parse.Cloud.afterSave("Activity", function(request) {

  var query = new Parse.Query(Parse.Installation);

  var fetchQuery = new Parse.Query(Activity);
  fetchQuery.include("from");
  fetchQuery.include("event");
  fetchQuery.include("users");
  fetchQuery.get(request.object.id, {
    success: function(activity) {

      query.equalTo("notifications", activity.get("activityType"));
      query.containedIn("user", activity.get("observers"));

      var users = activity.get("users");
      var lastUser;
      if (users) {
        lastUser = users[users.length - 1];
      }

      var messageText = "";
      switch (activity.get("activityType")) {
        case activityType.KLActivityTypeFollowMe:
            messageText = lastUser.get("fullName") + " started following you.";
            break;
        case activityType.KLActivityTypeFollow:
            messageText = activity.get("from").get("fullName") + " started following " + lastUser.get("fullName") + ".";
            break;
        case activityType.KLActivityTypeCreateEvent:
            messageText = activity.get("from").get("fullName") + " created event.";
            break;
        case activityType.KLActivityTypeGoesToEvent:
            messageText = activity.get("from").get("fullName") + " is going to " + activity.get("event").get("title") + ".";
            break;
        case activityType.KLActivityTypeGoesToMyEvent:
            messageText = lastUser.get("fullName") + " is going to your event.";
            break;
        case activityType.KLActivityTypeEventCanceled:
            messageText = "Event " + activity.get("deletedEventTitle") + " has been canceled.";
            break;
        case activityType.KLActivityTypeEventChangedName:
        case activityType.KLActivityTypeEventChangedTime:
        case activityType.KLActivityTypeEventChangedLocation:
            messageText = "Event " + activity.get("event").get("title") + " has been changed.";
            break;
        case activityType.KLActivityTypePayForEvent:
            messageText = activity.get("from").get("fullName") + " paid for your event";
            break;
        case activityType.KLActivityTypePhotosAdded:
            messageText = activity.get("from").get("fullName") + " add photo to your event.";
            break;
        case activityType.KLActivityTypeCommentAdded:
        case activityType.KLActivityTypeCommentAddedToAttendedEvent:
            messageText = activity.get("from").get("fullName") + " commented " + activity.get("event").get("title") + ".";
            break;
        case activityType.KLActivityTypeFacebookFriendRegistered:
            messageText = "Your facebook friend " + activity.get("from").get("fullName") + " joined Konvene!";
            break;
        default:
            break;
      }

      if (activity.get("activityType") === activityType.KLActivityTypeGoesToEvent) {
        var endQuery = new Parse.Query(Parse.Installation);
        endQuery.equalTo("user", activity.get("from").id);

        var event = activity.get('event');
        var body = {
            alert: "\"" +event.get("title") + "\" has ended, tell us about your experience",
            badge: "Increment"
          };
        if (event) {
          body.eventId = event.id;
        }
        Parse.Push.send({
          where: endQuery,
          data: body,
          push_time: event.get("endDate")
        }, {
          success: function() {
            console.log("Send end event push successfuly!");
          },
          error: function(error) {
            console.log("End event push notification error");
            console.log(error);
          }
        });
      }

      var body = {
          alert: messageText,
          badge: "Increment"
        };
      var event = activity.get('event');
      if (event) {
        body.eventId = event.id;
      } else if (activity.get("activityType") === activityType.KLActivityTypeFollowMe) {
        body.userId = lastUser.id;
      } else if (activity.get("activityType") === activityType.KLActivityTypeFollow) {
        body.userId = activity.get("from").id;
      }
      Parse.Push.send({
        where: query,
        data: body
      }, {
        success: function() {
          console.log("Send push successfuly!");
        },
        error: function(error) {
          console.log("Push notification error");
          console.log(error);
        }
      });
    },
    error: function(object, error) {
      console.log("error: "+error.code+" "+error.message);
    }
  });
});

//---
//---
//---
//!!! Background jobs
//---
//---
//---

Parse.Cloud.job("cleanEventData", function(request, status) {
  background.cleanEventData(request.params.eventId).then(function() {
    status.success("Update events successfully.");
  }, function(error) {
    console.log(error);
    status.error("Uh oh, something went wrong.");
  });
});

//---
//---
//---
//!!! Depricated funciton for old versions !!!
//---
//---
//---

Parse.Cloud.define("checkUsersFromContacts", function(request, response) {
  var phonesArray = request.params.phonesArray;
  var query = new Parse.Query(Parse.User);
  query.containedIn("phoneNumber", phonesArray);
  query.equalTo("isRegistered", true);
  query.find({
    success: function (usersArray) {
      response.success(usersArray);
    },
    error: function (error) {
      response.error(err.message);
    }
  });
});
