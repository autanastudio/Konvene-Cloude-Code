  var UserPayment = Parse.Object.extend("UserPayment");
  var UserVenmo = Parse.Object.extend("UserVenmo");
  var Card = Parse.Object.extend("Card");
  var KonvenePayment = Parse.Object.extend("Charge");

  var stripeSecretKey = "sk_test_4ZGEKkDI9mNRzfaHlt1R5w3c";
  // var stripeSecretKey = "sk_live_4ZGEhsecTkKjo8xDRMvr89TA";
  var strpeBaseURL = "api.stripe.com/v1";
  var venmoClientID = "2896";
  var venmoClientSecret = "dpAxjgACZCqdhpb6UyhUczCDCz8hPqaS";

  var Stripe = require('stripe');

  Stripe.initialize(stripeSecretKey);

  function createCustomer(user, callBack) {
    Stripe.Customers.create({
      account_balance: 0,
      description: 'new stripe user',
      metadata: {
        userId: user.objectId,
        createWithCard: false
      }
    }, {
      success: function(httpResponse) {
        console.log("Success create" + httpResponse);
        callBack(httpResponse.id);
      },
      error: function(httpResponse) {
        console.log("Error while create" + httpResponse);
        callBack();
      }
    });
  }

  function getVenmoInfo(user, callBack) {
    var userVenmo = user.get('venmoInfo');
    if (userVenmo !== undefined) {
      var fetchQuery = new Parse.Query(UserVenmo);
      fetchQuery.get(userVenmo.id, {
        success: function(venmoInfo) {
          if (venmoInfo) {
            callBack(venmoInfo);
          } else {
            console.log("This venmo info doesnt exist!");
            callBack();
          }
        },
        error: function(object, error) {
          console.log("error: "+error.code+" "+error.message);
          callBack();
        }
      });
    }
  }

  function getPaymentInfo(user, callBack) {
    var userPayment = user.get('paymentInfo');
    if (userPayment !== undefined) {
      var fetchQuery = new Parse.Query(UserPayment);
      fetchQuery.get(userPayment.id, {
        success: function(paymentInfo) {
          if (paymentInfo) {
            console.log("Payment info fetched");
            callBack(paymentInfo);
          } else {
            console.log("This payment info doesnt exist!");
            callBack();
          }
        },
        error: function(object, error) {
          console.log("error: "+error.code+" "+error.message);
          userPayment = new UserPayment();
          createCustomer(user, function(customerId){
            console.log("Create new customer " + customerId);
            userPayment.set("customerId", customerId);
            callBack(userPayment);
          });
        }
      });
    } else {
      userPayment = new UserPayment();
      createCustomer(user, function(customerId){
        console.log("Create new customer " + customerId);
        userPayment.set("customerId", customerId);
        callBack(userPayment);
      });
    }
  }

  function getCard(cardId, callBack) {
    var fetchQuery = new Parse.Query(Card);
    fetchQuery.get(cardId, {
      success: function(card) {
        if (card) {
          callBack(card);
        } else {
          console.log("This payment info doesnt exist!");
          callBack();
        }
      },
      error: function(object, error) {
        console.log("error: "+error.code+" "+error.message);
        callBack();
      }
    });
  }

  function addCard(user, source, callBack) {
    getPaymentInfo(user, function(paymentInfo){
      Parse.Cloud.httpRequest({
        method:"POST",
        url: "https://" + stripeSecretKey + ':@' + strpeBaseURL + "/customers/" + paymentInfo.get("customerId") + "/cards",
        body: "card=" + source,
        success: function(httpResponse) {
          var jsonResult = JSON.parse(httpResponse.text);
          var newCard = new Card();
          newCard.set("cardId", jsonResult.id);
          newCard.set("last4", jsonResult.last4);
          newCard.set("brand", jsonResult.brand);
          newCard.set("expMonth", jsonResult.exp_month);
          newCard.set("expYear", jsonResult.exp_year);
          paymentInfo.addUnique("cards", newCard);
          callBack(paymentInfo, null);
        },
        error: function(httpResponse) {
          console.log('Request failed with response code ' + httpResponse.status);
          var jsonResult = JSON.parse(httpResponse.text);
          callBack(null, jsonResult.error.message);
        }
      });
    });
  }

  function removeCard(user, cardId, callBack) {
    getCard(cardId, function(card){
      getPaymentInfo(user, function(paymentInfo){
        paymentInfo.remove("cards", card);
        paymentInfo.save(null, {
          useMasterKey: true,
          success: function() {
            console.log("Save payment info ok");
            removeCardFromStripe(paymentInfo.get('customerId'), card, function(error){
              if (error) {
                card.destroy({
                  success: function(myObject) {
                    callBack(paymentInfo, null);
                  },
                  error: function(myObject, error) {
                    callBack(null, error);
                  }
                });
              } else {
                callBack(null, error);
              }
            });
          },
          error: function(object, error) {
            console.log("Save payment info error: "+error.code+" "+error.message);
            callBack(null, error);
          }
        });
      });
    });
  }

  function removeCardFromStripe(customerId, card, callBack) {
    Parse.Cloud.httpRequest({
      method:"DELETE",
      url: "https://" + stripeSecretKey + ':@' + strpeBaseURL + "/customers/" + customerId + "/sources/" + card.get("cardId"),
      success: function(httpResponse) {
        callBack(null);
      },
      error: function(httpResponse) {
        console.log('Request failed with response code ' + httpResponse.status);
        console.log(httpResponse);
        var jsonResult = JSON.parse(httpResponse.text);
        callBack(jsonResult.error.message);
      }
    });
  }

  function authorizeWithStripeConnect(user, code, callBack) {

    var querystring = require('querystring');
    var body = querystring.stringify({'client_secret':stripeSecretKey , 'code':code, 'grant_type':'authorization_code'});

    Parse.Cloud.httpRequest({
      method:"POST",
      url: "https://connect.stripe.com/oauth/token",
      body: body,
      success: function(httpResponse) {
        var jsonResult = JSON.parse(httpResponse.text);
        console.log(jsonResult);
        user.set('stripeId', jsonResult.stripe_user_id);
        callBack(user);
      },
      error: function(httpResponse) {
        console.log('Request failed with response code ' + httpResponse.status + httpResponse.text);
        var jsonResult = JSON.parse(httpResponse.text);
        callBack(null, jsonResult.error.message);
      }
    });
  }

  function changeSource(customerId, card, callBack) {
    Parse.Cloud.httpRequest({
      method:"POST",
      url: "https://" + stripeSecretKey + ':@' + strpeBaseURL + "/customers/" + customerId,
      body: "source=" + card.get("cardId"),
      success: function(httpResponse) {
        callBack(null);
      },
      error: function(httpResponse) {
        console.log('Request failed with response code ' + httpResponse.status);
        var jsonResult = JSON.parse(httpResponse.text);
        callBack(jsonResult.error.message);
      }
    });
  }

  function venmoPayment(user, owner, amount, callBack) {
    getVenmoInfo(user, function(sendingVenmoInfo){
      if (sendingVenmoInfo == undefined) {
        callBack(null, "error finding sender venmo info");
        return;
      }

      getVenmoInfo(owner, function(receivingVenmoInfo){
        if (receivingVenmoInfo == undefined) {
          callBack(null, "error finding recip venmo info");
          return;
        }

        var querystring = require('querystring');
        var body = querystring.stringify({
          'access_token': sendingVenmoInfo.get('accessToken'),//'1ae30922211e64162944471b86ead63f0737768780df4b0023944eb270da6418',
          'user_id': receivingVenmoInfo.get('userID'),//'145434160922624933',
          'note': 'Payment for Konvene Event',
          'audience': 'public',
          'amount': amount
        });

        Parse.Cloud.httpRequest({
          method:"POST",
          url: "https://api.venmo.com/v1/payments",
          body: body,
          success: function(httpResponse) {
            var jsonResult = JSON.parse(httpResponse.text);
            // console.log("text"+httpResponse.text);
            // console.log("json"+jsonResult);
            var newCharge = new KonvenePayment();
            newCharge.set("paymentId", jsonResult.data.payment.id);
            newCharge.set("owner", user);
            newCharge.set("amount", amount);
            newCharge.save(null, {
              useMasterKey: true,
              success: function(charge) {
                callBack(charge, null);
              },
              error: function(error) {
                console.log("Save charge error: "+error.code+" "+error.message);
                callBack(null, "Charge save error");
              }
            });
          },
          error: function(httpResponse) {
            var jsonResult = JSON.parse(httpResponse.text);
            console.log("venmo error"+httpResponse.text);
            if (jsonResult.error.code == 13004) {
              callBack(null, "no linked accounts");
            } else {
              callBack(null, jsonResult.error.message);
            }
          }
        });
      });
    });
  }

  function charge(user, cardId, owner, amount, callBack) {
    getCard(cardId, function(card){
      getPaymentInfo(user, function(paymentInfo){
        changeSource(paymentInfo.get("customerId"), card, function(errorMessage){
          if (errorMessage) {
            callBack(null, errorMessage);
          } else {
            var querystring = require('querystring');
            var amountForCharge = amount * 100;
            var userCharge = amountForCharge * 0.029 + 30;
            var percent =  (amountForCharge - userCharge) * 0.02;
            var intFee = Math.ceil(percent+userCharge);
            console.log ("Fee " + intFee);
            var body = querystring.stringify({
              'amount': amountForCharge,
              'currency':'usd',
              'customer': paymentInfo.get("customerId"),
              'destination': owner.get('stripeId'),
              'application_fee': intFee,
            });

            Parse.Cloud.httpRequest({
              method:"POST",
              url: "https://" + stripeSecretKey + ':@' + strpeBaseURL + "/charges",
              body: body,
              success: function(httpResponse) {
                var jsonResult = JSON.parse(httpResponse.text);
                var newCahrge = new KonvenePayment();
                newCahrge.set("chargeId", jsonResult.id);
                newCahrge.set("owner", user);
                newCahrge.set("card", card);
                newCahrge.set("amount", amount);
                callBack(newCahrge, null);
              },
              error: function(httpResponse) {
                console.log('Request failed with response code ' + httpResponse.status);
                var jsonResult = JSON.parse(httpResponse.text);
                if (httpResponse.status === 400) {
                  owner.set('stripeId', '');
                  owner.save(null, {
                    useMasterKey: true,
                    success: function() {
                      console.log("Save user ok");
                      callBack(null, jsonResult.error.message);
                    },
                    error: function(object, error) {
                      console.log("Save user error: "+error.code+" "+error.message);
                      callBack(null, jsonResult.error.message);
                    }
                  });
                } else {
                  callBack(null, jsonResult.error.message);
                }
              }
            });
          }
        });
      });
    });
  }

module.exports = {
  addCard: addCard,
  removeCard: removeCard,
  charge: charge,
  venmoPayment: venmoPayment,
  authorizeWithStripeConnect : authorizeWithStripeConnect,
};
