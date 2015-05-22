  var CodeStorage = Parse.Object.extend("CodeStorage");
  
  /**
   * Create a Parse ACL which prohibits public access.  This will be used
   *   in several places throughout the application, to explicitly protect
   *   Parse User, TokenRequest, and TokenStorage objects.
   */
  var restrictedAcl = new Parse.ACL();
  restrictedAcl.setPublicReadAccess(false);
  restrictedAcl.setPublicWriteAccess(false);
  
  var _ = require("underscore");
  var Buffer = require("buffer").Buffer;
  
  function requireCode(phoneNumber) {
    var code = _.random(100000, 999999).toString();
    // var code = String(123321);
 
 
    var query = new Parse.Query(Parse.User);
    var allDone = new Parse.Promise();
    query.equalTo("phoneNumber", phoneNumber);
  
    var saveCodeData = function(user) {
      getCodeData(user, function(cs){
        cs.set("verificationCode", code);
        cs.save(null, {
          useMasterKey: true,
          success: function() {
            console.log("cs save ok");
            sendVerificationCode(phoneNumber, code, function(){
              allDone.resolve("Codedata successfully saved.");
            });
          },
          error: function(cs, error) {
            console.log("cs save error: "+error.code+" "+error.message);
            allDone.reject("Error while saving codedata.");
          }
        });
      });
    };
  
    query.first({
      success: function(user) {
        if(user) {
          console.log("user found: "+user.id);
          saveCodeData(user);
        } else {
          console.log("user not found, creating new one");
          newUser(phoneNumber, function(user) {
            saveCodeData(user);
          });
            
        }
      },
      error: function(error) {
        console.log("error: "+ error.code+" "+error.message);
          
      }
    });
  
    return allDone;
  }
 
  function getUserWithCode(phoneNumber, code, callBack) {
    var query = new Parse.Query(Parse.User);
    query.equalTo("phoneNumber", phoneNumber);
    query.first({
      success: function(user) {
        if(user) {
          console.log("user found: "+user.id);
          getCodeData(user, function(cs){
            var verificationCode = cs.get("verificationCode");
            if (verificationCode !== code) {
              callBack(null, JSON.stringify({code: 101, message: "Wrong verification code"}));
            } else {
              callBack(user, null);
            }
          });
        } else {
          console.log("user not found");
          callBack(null, JSON.stringify({code: 103, message: "User not found!"}));
        }
      },
      error: function(error) {
        console.log("error: "+error.code+" "+error.message);
        callBack(null, JSON.stringify({code: 104, message: "User not found", error: error}));
      }
    });
  }
 
  var getCodeData = function(user, callBack) {
    var query = new Parse.Query(CodeStorage);
    query.equalTo('user', user);
    Parse.Cloud.useMasterKey();
    query.first({
      success: function(cs) {
        if(cs) {
          console.log("CodeStorage found: " + cs.id);
          callBack(cs);
        } else {
          console.log("CodeStorage not found, creating new one");
          cs = new CodeStorage();
          cs.set("user", user);
          cs.setACL(restrictedAcl);
          callBack(cs);
        }
      },
      error: function(error) {
        console.log("error: " + error.code + " " + error.message);
         
      }
    });
  };
  
  var newUser = function(phoneNumber, callBack) {
    var user = new Parse.User();
    // Generate a random username and password.
    var username = new Buffer(24); var password = new Buffer(24); _.times(24, function(i) {
      username.set(i, _.random(0, 255));
      password.set(i, _.random(0, 255));
    });
    user.set("username", username.toString("base64"));
    user.set("password", password.toString("base64"));
    user.set("phoneNumber", phoneNumber);
 
    user.signUp().then(function(user) {
      console.log("signup then");
      callBack(user);
    });
     
  };
  
  var sendVerificationCode = function(phoneNumber, code, callBack) {
  
    // Require and initialize the Twilio module with your credentials
    var twillioAccountSid = "AC7b4bf284350036a68aa56aa7148cfabd";
    var twillioAuthToken = "33f30213ff99dbc33dcb4d9b93d6a6ea"; 
    var twillioNumber = "+18036102686";
    var client = require('twilio')(twillioAccountSid, twillioAuthToken);
  
    var messageBody = "Your confirmation code for Konvene is " + code;
    console.log("Send message to: " + phoneNumber + " Message: " + messageBody);
    client.sendSms({
      to:   phoneNumber, 
      from: twillioNumber, 
      body: messageBody
    }, function(err, responseData) { 
      if (err) {
        console.log(err);
      } else { 
        console.log(responseData.from); 
        console.log(responseData.body);
      }
      callBack();
    });
  };
 
module.exports = {
  requireCode: requireCode,
  getUserWithCode: getUserWithCode
};