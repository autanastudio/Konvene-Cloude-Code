var Invite = Parse.Object.extend("Invite");
var EventExtension = Parse.Object.extend("EventExtension");
var Activity = Parse.Object.extend("Activity");

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
      response.success(usersArray);
    },
    error: function (error) {
      response.error(err.message);
    }
  });
});

Parse.Cloud.define("deleteUser", function(request, response) {
  var sender = request.user;
  sender.set('isDeleted', 1);
  sender.save(null, {
    useMasterKey: true,
    success: function() {
      console.log("Delete user ok");
      response.success(sender);
    },
    error: function(object, error) {
      console.log("Save user error: "+error.code+" "+error.message);
      response.error(JSON.stringify({code: 101, message: "Error while deleting!"}));
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
            }

            sender.save(null, {
              useMasterKey: true,
              success: function() {
                console.log("Sender save ok");
                following.save(null, {
                  useMasterKey: true,
                  success: function() {
                    console.log("Following save ok");

                    addActivity(activityType.KLActivityTypeFollowMe, sender, null, following, null, function(errorMessage){
                      if (errorMessage) {
                        response.error(errorMessage);
                      } else {
                        addActivity(activityType.KLActivityTypeFollow, sender, null, following, null, function(errorMessage){
                          if (errorMessage) {
                            response.error(errorMessage);
                          } else {
                            response.success(sender);
                          }
                        });
                      }
                    });

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
          response.error(JSON.stringify({code: 107, message: "Follow search error", error: error}));
        }
      });
    },
    error: function(object, error) {
          console.log("error: "+error.code+" "+error.message);
          response.error(JSON.stringify({code: 109, message: "Fetch user error", error: error}));
    } 
  });
});

Parse.Cloud.define("vote", function(request, response) {
  var sender = request.user;
  var value = request.params.voteValue;
  var eventId = request.params.eventId;
  var fetchQuery = new Parse.Query(Parse.Object.extend("Event"));
  fetchQuery.include("extension");
  fetchQuery.get(eventId, {
    success: function(eventObject) {
      var owner = eventObject.get("owner");
      var extension = eventObject.get("extension");
      if (owner.id === sender.id) {
        response.error(JSON.stringify({code: 110, message: "You cant vote for your event!"}));
      } else if (extension &&  indexOf.call(extension.get("voters"), sender.id) !== -1) {
        response.error(JSON.stringify({code: 108, message: "You alredy vote for event!"}));
      } else {
        var weight = [-2, -1, 0, 1, 2];
        if (!extension) {
          extension = new EventExtension();
          eventObject.set("extension", extension);
        }
        extension.addUnique("voters", sender.id);
        var raiting = extension.get("raiting");
        if (raiting) {
          raiting = raiting + weight[value];
        } else {
          raiting = weight[value];
        }
        extension.set("raiting", raiting);
        eventObject.save(null, {
          useMasterKey: true,
          success: function() {
            console.log("Event save ok");
            raiting = owner.get("raiting");
            if (raiting) {
              raiting = raiting + weight[value];
            } else {
              raiting = weight[value];
            }
            owner.set("raiting", raiting);
            owner.save(null, {
              useMasterKey: true,
              success: function() {
                console.log("Save event ok");
                response.success(eventObject);
              },
              error: function(object, error) {
                console.log("Save event error: "+error.code+" "+error.message);
                response.error(JSON.stringify({code: 106, message: "Event save error"}));
              }
            });
          },
          error: function(object, error) {
            console.log("EventExtension save error: "+error.code+" "+error.message);
            response.error(JSON.stringify({code: 106, message: "EventExtension save error"}));
          }
        });
      }
    },
    error: function(object, error) {
      console.log("error: "+error.code+" "+error.message);
      response.error(JSON.stringify({code: 109, message: "Event fetch error", error: error}));
    } 
  });
});

Parse.Cloud.define("invite", function(request, response) {
  var sender = request.user;
  var invitedId = request.params.invitedId;
  var eventId = request.params.eventId;
  var isInvite = request.params.isInvite;
  if (isInvite === undefined) {
    isInvite = 1;
  }
  if (sender.id === invitedId) {
    response.error(JSON.stringify({code: 105, message: "You cannot invite yourself!"}));
  }
  var fetchQuery = new Parse.Query(Parse.Object.extend("Event"));
  fetchQuery.get(eventId, {
    success: function(eventObject) {
      var privacyType = eventObject.get("privacy");
      var owner = eventObject.get("owner");
      if (privacyType === 2 && !(indexOf.call((eventObject.get("invited"), sender.id) !== -1) || (owner.id === sender.id))) {
        response.error(JSON.stringify({code: 110, message: "You doesnt have permissions for this operation!"}));
      } else if (privacyType === 1 && owner.id !== sender.id) {
        response.error(JSON.stringify({code: 110, message: "You doesnt have permissions for this operation!"}));
      } else {
        if (isInvite) {
          eventObject.addUnique("invited", invitedId);
        } else {
          eventObject.remove("invited", invitedId);
        }
        eventObject.save(null, {
          useMasterKey: true,
          success: function() {
            console.log("Event save ok");
            if (isInvite) {
              inviteUser(eventObject, sender, invitedId, response);
            } else {
              console.log(isInvite);
              deleteInviteUser(eventObject, sender, invitedId, response);
            }
          },
          error: function(object, error) {
            console.log("Event save error: "+error.code+" "+error.message);
            response.error(JSON.stringify({code: 106, message: "Event save error"}));
          }
        });
      }
    },
    error: function(object, error) {
      console.log("error: "+error.code+" "+error.message);
      response.error(JSON.stringify({code: 109, message: "Event fetch error", error: error}));
    } 
  });
});

Parse.Cloud.define("attend", function(request, response) {
  var sender = request.user;
  var eventId = request.params.eventId;
  var fetchQuery = new Parse.Query(Parse.Object.extend("Event"));
  fetchQuery.include("price");
  fetchQuery.get(eventId, {
    success: function(eventObject) {
      var price = eventObject.get("price");
      var pricingType = price.get('pricingType');
      var minimumAmount = price.get('minimumAmount');
      console.log("Min " + minimumAmount + " type " + pricingType);
      if (pricingType === 0 || (pricingType===2 && minimumAmount === 0)) {
        if (indexOf.call(eventObject.get("attendees"), sender.id) !== -1) {
          eventObject.remove("attendees", sender.id);
          eventObject.save(null, {
            useMasterKey: true,
            success: function() {
              console.log("Event save ok");
              response.success(eventObject);
            },
            error: function(object, error) {
              console.log("Event save error: "+error.code+" "+error.message);
              response.error(JSON.stringify({code: 106, message: "Event save error"}));
            }
          });
        } else {
          eventObject.addUnique("attendees", sender.id);
          eventObject.save(null, {
            useMasterKey: true,
            success: function() {
              console.log("Event save ok");

              addActivity(activityType.KLActivityTypeGoesToMyEvent, sender, eventObject, eventObject.get("owner"), null, function(errorMessage){
                if (errorMessage) {
                  response.error(errorMessage);
                } else {
                  addActivity(activityType.KLActivityTypeGoesToEvent, sender, eventObject, null, null, function(errorMessage){
                    if (errorMessage) {
                      response.error(errorMessage);
                    } else {
                      response.success(eventObject);
                    }
                  });
                }
              });

            },
            error: function(object, error) {
              console.log("Event save error: "+error.code+" "+error.message);
              response.error(JSON.stringify({code: 106, message: "Event save error"}));
            }
          });
        }
      } else {
        response.error(JSON.stringify({code: 111, message: "You should pay for this event!"}));
      }
    },
    error: function(object, error) {
          console.log("error: "+error.code+" "+error.message);
          response.error(JSON.stringify({code: 109, message: "Event fetch error", error: error}));
    } 
  });
});

var inviteUser = function(event, from, toId, response) {
    var query = new Parse.Query(Invite);
    var to = new Parse.User();
    to.id = toId;
    query.equalTo('to', to);
    query.equalTo('event', event);
    query.first({
      success: function(invite) {
        if(invite) {
          response.error(JSON.stringify({code: 108, message: "You alredy invite this user"}));
        } else {
          console.log("Invite not found, creating new one");
          to.set("invited", 1);
          invite = new Invite();
          invite.set('from', from);
          invite.set('to', to);
          invite.set('event', event);
          invite.set('status', 0);
          invite.save(null, {
            useMasterKey: true,
            success: function() {
              console.log("Invite save ok");              
              response.success(event);
            },
            error: function(object, error) {
              console.log("Invite save error: "+error.code+" "+error.message);
              response.error(JSON.stringify({code: 106, message: "Invite save error"}));
            }
      });
        }
      },
      error: function(error) {
        console.log("error: " + error.code + " " + error.message);
        response.error(JSON.stringify({code: 106, message: "Invite delete error"}));
      }
    });
};

var deleteInviteUser = function(event, from, toId, response) {
  var query = new Parse.Query(Invite);
  var to = new Parse.User();
  to.id = toId;
  query.equalTo('to', to);
  query.equalTo('event', event);
  query.first({
    success: function(invite) {
      if(invite) {
        invite.destroy({
          useMasterKey: true,
          success: function() {
            console.log("Invite delete ok");              
            response.success(event);
          },
          error: function(object, error) {
            console.log("Invite save error: "+error.code+" "+error.message);
            response.error(JSON.stringify({code: 106, message: "Invite delete error"}));
          }
        });
      } else {
        response.error(JSON.stringify({code: 108, message: "Cant find this invite"}));
      }
    },
    error: function(error) {
      console.log("error: " + error.code + " " + error.message);
      response.error(JSON.stringify({code: 106, message: "Invite delete error"}));
    }
  });
};

Parse.Cloud.afterSave("Event", function(request) {
  if (request.object.existed() === false) {
    var owner = request.object.get("owner");
    owner.addUnique("createdEvents", request.object.id);
    owner.save(null, {
      useMasterKey: true,
      success: function() {
        console.log("Create event ok");
        var fetchQuery = new Parse.Query(Parse.User);
        fetchQuery.get(owner.id, {
          success: function(user) {
            if (user) {
              addActivity(activityType.KLActivityTypeCreateEvent, user, request.object, null, null, function(errorMessage){
                if (errorMessage) {
                  console.log(errorMessage);
                }
              });
            }
          },
          error: function(object, error) {
            console.log("error: "+error.code+" "+error.message);
            callBack();
          } 
        });

      },
      error: function(object, error) {
        console.log("Create event error: "+error.code+" "+error.message);
      }
    });
  }
});

Parse.Cloud.afterDelete("Event", function(request) {
  var owner = request.object.get("owner");
  owner.remove("createdEvents", request.object.id);
  owner.save(null, {
    useMasterKey: true,
    success: function() {
      console.log("Remove event ok");
      addActivity(activityType.KLActivityTypeEventCanceled, owner, request.object, null, null, function(errorMessage){
          if (errorMessage) {
            console.log(errorMessage);
          }
      });
    },
    error: function(object, error) {
      console.log("Remove event error: "+error.code+" "+error.message);
    }
  });
});

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

Parse.Cloud.define("buyTickets", function(request, response) 
{
  var klpayment = require('cloud/klpayment.js');
  var owner = request.user;
  var cardId = request.params.cardId;
  var payValue = request.params.payValue;
  var eventId = request.params.eventId;
  var fetchQuery = new Parse.Query(Parse.Object.extend("Event"));
  fetchQuery.include("price");
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
          klpayment.charge(owner, cardId, price.get('stripeId'), amount, function(newCharge, errorMessage){
            if (errorMessage) {
              response.error(JSON.stringify({code:111, message: errorMessage}));
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
                  console.log("Event save ok");

                  addActivity(activityType.KLActivityTypePayForEvent, owner, eventObject, eventObject.get("owner"), null, function(errorMessage){
                    if (errorMessage) {
                      response.error(errorMessage);
                    } else {
                      response.success(eventObject);
                    }
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

Parse.Cloud.define("throwIn", function(request, response) 
{
  var klpayment = require('cloud/klpayment.js');
  var owner = request.user;
  var cardId = request.params.cardId;
  var payValue = request.params.payValue;
  var eventId = request.params.eventId;
  var fetchQuery = new Parse.Query(Parse.Object.extend("Event"));
  fetchQuery.include("price");
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
          klpayment.charge(owner, cardId, price.get('stripeId'),  payValue, function(newCharge, errorMessage){
            if (errorMessage) {
              response.error(JSON.stringify({code:111, message: errorMessage}));
            } else {
              newCharge.set('event', eventObject);
              var price = eventObject.get('price');
              price.addUnique("payments", newCharge);
              var gathered = price.get("throwIn")
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
                  console.log("Event save ok");

                  addActivity(activityType.KLActivityTypePayForEvent, owner, eventObject, eventObject.get("owner"), null, function(errorMessage){
                    if (errorMessage) {
                      response.error(errorMessage);
                    } else {
                      response.success(eventObject);
                    }
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

var activityType = {
    KLActivityTypeFollowMe :              0,
    KLActivityTypeFollow :                1,
    KLActivityTypeCreateEvent :           2,
    KLActivityTypeGoesToEvent :           3,
    KLActivityTypeGoesToMyEvent :         4,
    KLActivityTypeEventCanceled :         5,
    KLActivityTypeEventChangedName :      6,
    KLActivityTypeEventChangedLocation :  7,
    KLActivityTypeEventChangedTime :      8,
    KLActivityTypePhotosAdded :           9,
    KLActivityTypeCommentAdded :          10,
    KLActivityTypePayForEvent :           11
}

Parse.Cloud.afterSave("Invite", function(request) {

  var query = new Parse.Query(Parse.Installation);

  var fetchQuery = new Parse.Query(Invite);
  fetchQuery.include("from");
  fetchQuery.include("event");
  fetchQuery.include("to");
  fetchQuery.get(request.object.id, {
    success: function(invite) {

      query.equalTo("user", invite.get("to").id);

      messageText = invite.get("from").get("fullName") + " invite you to " + invite.get("event").get("title") + ".";
      console.log(messageText);

      Parse.Push.send({
        where: query,
        data: {
          alert: messageText,
          badge: "Increment"
        }
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
      console.log(activity.get("observers"));
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
            messageText = activity.get("from").get("fullName") + " goes to the event.";
            break;
        case activityType.KLActivityTypeGoesToMyEvent:
            messageText = lastUser.get("fullName") + " goes to your event.";
            break;
        case activityType.KLActivityTypeEventCanceled:
            messageText = "Event " + activity.get("event").get("title") + " has been canceled.";
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
            messageText = "Somene add photo to your event.";
            break;
        case activityType.KLActivityTypeCommentAdded:
            messageText = "Someone add comment to your event.";
            break;
        default:
            break;
      }
      console.log(messageText);

      Parse.Push.send({
        where: query,
        data: {
          alert: messageText,
          badge: "Increment"
        }
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

function addActivity(type, from, event, to, photo, callback) {
  switch (type) {
    case activityType.KLActivityTypeFollowMe:
        var query = new Parse.Query(Activity);
        query.equalTo("activityType", type);
        query.equalTo("observers", to.id);
        query.first({
          success: function (oldActivity) {
            if (!oldActivity) {
              oldActivity = new Activity();
              oldActivity.set("activityType", type);
              oldActivity.addUnique("observers", to.id);
            }
            oldActivity.addUnique("users", from);
            oldActivity.save(null, {
              useMasterKey: true,
              success: function() {
                console.log("Activity save ok");
                callback(null);
              },
              error: function(object, error) {
                console.log("Activity save error: "+error.code+" "+error.message);
                callback(JSON.stringify({code: 106, message: "Activity save error"}));
              }
            });
          },
          error: function (error) {
            callback(error.message);
          }
        });
        break;
    case activityType.KLActivityTypeFollow:
        var query = new Parse.Query(Activity);
        query.equalTo("activityType", type);
        query.equalTo("from", from);
        query.first({
          success: function (oldActivity) {
            console.log(oldActivity);
            if (!oldActivity) {
              oldActivity = new Activity();
              oldActivity.set("activityType", type);
              oldActivity.set("from", from);
            }
            oldActivity.set("observers", from.get("followers"));
            oldActivity.addUnique("users", to);
            oldActivity.save(null, {
              useMasterKey: true,
              success: function() {
                console.log("Activity save ok");
                callback(null);
              },
              error: function(object, error) {
                console.log("Activity save error: "+error.code+" "+error.message);
                callback(JSON.stringify({code: 106, message: "Activity save error"}));
              }
            });
          },
          error: function (error) {
            callback(error.message);
          }
        });
        break;
    case activityType.KLActivityTypeCreateEvent:
        oldActivity = new Activity();
        oldActivity.set("activityType", type);
        oldActivity.set("from", from);
        oldActivity.set("event", event);
        oldActivity.set("observers", from.get("followers"));
        oldActivity.save(null, {
          useMasterKey: true,
          success: function() {
            console.log("Activity save ok");
            callback(null);
          },
          error: function(object, error) {
            console.log("Activity save error: "+error.code+" "+error.message);
            callback(JSON.stringify({code: 106, message: "Activity save error"}));
          }
        });
        break;
    case activityType.KLActivityTypeGoesToEvent:
        oldActivity = new Activity();
        oldActivity.set("activityType", type);
        oldActivity.set("from", from);
        oldActivity.set("event", event);
        oldActivity.set("observers", from.get("followers"));
        oldActivity.save(null, {
          useMasterKey: true,
          success: function() {
            console.log("Activity save ok");
            callback(null);
          },
          error: function(object, error) {
            console.log("Activity save error: "+error.code+" "+error.message);
            callback(JSON.stringify({code: 106, message: "Activity save error"}));
          }
        });
        break;
    case activityType.KLActivityTypeGoesToMyEvent:
        var query = new Parse.Query(Activity);
        query.equalTo("activityType", type);
        query.equalTo("observers", to.id);
        query.equalTo("event", event);
        query.first({
          success: function (oldActivity) {
            if (!oldActivity) {
              oldActivity = new Activity();
              oldActivity.set("activityType", type);
              oldActivity.set("event", event);
              oldActivity.addUnique("observers", to.id);
            }
            oldActivity.addUnique("users", from);
            oldActivity.save(null, {
              useMasterKey: true,
              success: function() {
                console.log("Activity save ok");
                callback(null);
              },
              error: function(object, error) {
                console.log("Activity save error: "+error.code+" "+error.message);
                callback(JSON.stringify({code: 106, message: "Activity save error"}));
              }
            });
          },
          error: function (error) {
            callback(error.message);
          }
        });
        break;
    case activityType.KLActivityTypeEventCanceled:
        oldActivity = new Activity();
        oldActivity.set("activityType", type);
        oldActivity.set("from", from);
        oldActivity.set("event", event);
        var attendees = event.get("attendees");
        var savers = event.get("savers");
        if (attendees && savers) {
          oldActivity.set("observers", attendees.concat(savers));
        } else if (attendees) {
          oldActivity.set("observers", attendees);
        } else if (savers) {
          oldActivity.set("observers", savers);
        }
        oldActivity.save(null, {
          useMasterKey: true,
          success: function() {
            console.log("Activity save ok");
            callback(null);
          },
          error: function(object, error) {
            console.log("Activity save error: "+error.code+" "+error.message);
            callback(JSON.stringify({code: 106, message: "Activity save error"}));
          }
        });
        break;
    case activityType.KLActivityTypePayForEvent:
        oldActivity = new Activity();
        oldActivity.set("activityType", type);
        oldActivity.set("from", from);
        oldActivity.set("event", event);
        oldActivity.addUnique("observers", to.id);
        oldActivity.save(null, {
          useMasterKey: true,
          success: function() {
            console.log("Activity save ok");
            callback(null);
          },
          error: function(object, error) {
            console.log("Activity save error: "+error.code+" "+error.message);
            callback(JSON.stringify({code: 106, message: "Activity save error"}));
          }
        });
        break;
    default:
        console.log("Unknown activity type");
        callback(JSON.stringify({code: 101, message: "Unknown activity type"}));
        break;
  }
}

var indexOf = function(needle) {
  if(typeof Array.prototype.indexOf === 'function') {
    indexOf = Array.prototype.indexOf;
  } else {
    indexOf = function(needle) {
      var i = -1, index = -1;
      for(i = 0; i < this.length; i++) {
        if(this[i] === needle) {
          index = i;
          break;
        }
      }
      return index;
    };
  }
  return indexOf.call(this, needle);
};