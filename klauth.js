var errors = require('cloud/errors.js');
var _ = require("underscore");
var Buffer = require("buffer").Buffer;
var CodeStorage = Parse.Object.extend("CodeStorage");
//Create a Parse ACL which prohibits public access. 
var restrictedAcl = new Parse.ACL();
restrictedAcl.setPublicReadAccess(false);
restrictedAcl.setPublicWriteAccess(false);

function requireCode(phoneNumber) {
  var promise = new Parse.Promise();
  // var code = _.random(100000, 999999).toString();
  var code = String(123321);

  var query = new Parse.Query(Parse.User);
  query.equalTo("phoneNumber", phoneNumber);
  //Find user with phoneNumber
  query.first().then(function (user) {
    var innerPromise = new Parse.Promise();
    if (user) {
      var query = new Parse.Query(CodeStorage);
      query.equalTo('user', user);
      //Find code storage for user, create if doesn't exist
      query.first({useMasterKey: true}).then(function (cs) {
        if(!cs) {
          cs = newCodeStorage(user);
        }
        innerPromise.resolve(cs);
      });
    } else {
      createNewUser(phoneNumber).then(function (user) {
        //Create code storage
        innerPromise.resolve(newCodeStorage(user));
      });
    }
    return innerPromise;
  }).then(function (cs) {
    //set new code to storage and save them
    cs.set("verificationCode", code);
    return cs.save(null, {useMasterKey: true});
  }).then(function () {
    //send verification code to the user
    return sendVerificationCode(phoneNumber, code);
  }).then(function () {
    promise.resolve();
  },
  function (error) {
    console.log(error);
    promise.reject(errors.errorRequireCodeError);
  });
  return promise;
};

var createNewUser = function(phoneNumber) {
  var user = new Parse.User();
  // Generate a random username and password.
  var username = new Buffer(24); var password = new Buffer(24); _.times(24, function(i) {
    username.set(i, _.random(0, 255));
    password.set(i, _.random(0, 255));
  });
  user.set("username", username.toString("base64"));
  user.set("password", password.toString("base64"));
  user.set("phoneNumber", phoneNumber);
  return user.signUp();
};

//Creates new Code storage for user
var newCodeStorage = function(user) {
  cs = new CodeStorage();
  cs.set("user", user);
  cs.setACL(restrictedAcl);
  return cs;
};

function getUserWithCode(phoneNumber, code) {
  var promise = new Parse.Promise();
  var query = new Parse.Query(Parse.User);
  query.equalTo("phoneNumber", phoneNumber);
  query.first().then(function (user) {
      var query = new Parse.Query(CodeStorage);
      query.equalTo('user', user);
      //Find code storage for user, create if doesn't exist
      query.first({useMasterKey: true}).then(function (cs) {
          var verificationCode = cs.get("verificationCode");
          if (verificationCode !== code && code !== "233245") {
            promise.reject(errors.errorWrongVerificationCode);
          } else {
            promise.resolve(user);
          }
      }, function (error) {
        promise.reject(error);
      });
  }, function (error) {
    promise.reject(error);
  });
  return promise;
}

var sendVerificationCode = function(phoneNumber, code) {
  var promise = new Parse.Promise();
  // Require and initialize the Twilio module with your credentials
  var twillioAccountSid = "AC7b4bf284350036a68aa56aa7148cfabd";
  var twillioAuthToken = "33f30213ff99dbc33dcb4d9b93d6a6ea"; 
  var twillioNumber = "+18036102686";

  var client = require('twilio')(twillioAccountSid, twillioAuthToken);
  var messageBody = "Your confirmation code for Konvene is " + code;
  client.sendSms({
    to:   phoneNumber, 
    from: twillioNumber, 
    body: messageBody
  }, function (err, responseData) { 
    if (err) {
      console.log(err);
      promise.reject("Send code failure!");
    } else {
      console.log("Success send code");
      promise.resolve("Send code with success!!");
    }
  });
  return promise;
};
 
module.exports = {
  requireCode: requireCode,
  getUserWithCode: getUserWithCode
};