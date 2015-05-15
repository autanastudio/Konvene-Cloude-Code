var Invite = Parse.Object.extend("Invite");


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

Parse.Cloud.define("invite", function(request, response) {
  var sender = request.user;
  var invitedId = request.params.invitedId;
  var eventId = request.params.eventId;
  if (sender.id === invitedId) {
    response.error(JSON.stringify({code: 105, message: "You cannot invite yourself!"}));
  }
  var fetchQuery = new Parse.Query(Parse.Object.extend("Event"));
  fetchQuery.get(eventId, {
    success: function(eventObject) {
      var privacyType = eventObject.get("privacy");
      if (privacyType === 1) {
        if (indexOf.call(eventObject.get("invited", sender.id))) {
          response.error(JSON.stringify({code: 110, message: "You doesnt have permissions for this operation!"}));
        }
      } else if (privacyType === 2) {
        var owner = eventObject.get("owner");
        if (owner.id !== sender.id) {
          response.error(JSON.stringify({code: 110, message: "You doesnt have permissions for this operation!"}));
        }
      }
      eventObject.addUnique("invited", invitedId);
      eventObject.save(null, {
        useMasterKey: true,
        success: function() {
          console.log("Event save ok");
          inviteUser(eventObject, sender, invitedId, response);
        },
        error: function(object, error) {
          console.log("Event save error: "+error.code+" "+error.message);
          response.error(JSON.stringify({code: 106, message: "Event save error"}));
        }
      });
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
  fetchQuery.get(eventId, {
    success: function(eventObject) {
      var privacyType = eventObject.get("privacy");
      if (privacyType !== 0 && indexOf.call(eventObject.get('invited', sender.id)) === -1) {
        response.error(JSON.stringify({code: 110, message: "You doesnt have permissions for this operation!"}));
      } else {
        var pricingType = eventObject.get('pricingType');
        var minimumAmount = eventObject.get('minimumAmount');
        if (pricingType===0 || (pricingType===2 && minimumAmount === 0)) {
          eventObject.addUnique("attendees", sender.id);
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
          response.error(JSON.stringify({code: 111, message: "You should pay for this event!"}));
        }
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
          invite = new Invite();
          invite.set('from', from);
          invite.set('to', to);
          invite.set('event', event);
          invite.set('status', 0);
          invite.save(null, {
            useMasterKey: true,
            success: function() {
              console.log("Invite save ok");              response.success(event);              response.success(event);
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

Parse.Cloud.define("deleteCard", function(request, response) 
{
  var klpayment = require('cloud/klpayment.js');
  var owner = request.user;
  var cardId = request.params.cardId;
  klpayment.removeCard(owner, cardId, function(errorMessage){
    if (errorMessage) {
      response.error(JSON.stringify({code:111, message: errorMessage}));
    } else {
      response.success();
    }
  });
});

Parse.Cloud.define("charge", function(request, response) 
{
  var klpayment = require('cloud/klpayment.js');
  var owner = request.user;
  var card = request.params.card;
  var amount = request.params.amount;
  var eventId = request.params.eventId;
  var fetchQuery = new Parse.Query(Parse.Object.extend("Event"));
  fetchQuery.includeKey("EventPrice");
  fetchQuery.get(eventId, {
    success: function(eventObject) {
      klpayment.charge(user, card, amount, function(newCharge, errorMessage){
        if (errorMessage) {
          response.error(JSON.stringify({code:111, message: errorMessage}));
        } else {
          newCharge.set('event', eventObject);
          var price = eventObject.get('price');
          price.addUnique(newCharge);
          price.save(null, {
            useMasterKey: true,
            success: function() {
              console.log("Save payment info ok");
              response.success();
            },
            error: function(object, error) {
              console.log("Save payment info error: "+error.code+" "+error.message);
              response.error(JSON.stringify({code: 106, message: "PaymentInfo save error"}));
            }
          });
        }
      });
    },
    error: function(object, error) {
          console.log("error: "+error.code+" "+error.message);
          response.error(JSON.stringify({code: 109, message: "Event fetch error", error: error}));
    } 
  });
});

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