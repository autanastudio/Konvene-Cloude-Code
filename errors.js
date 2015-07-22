module.exports = {
//Common
  errorWrongParameters : {code: 101, message: "Wrong request prarmeters!"},
  errorSaveObjectOnServer : {code: 102, message: "Can' save object on server!"},
//Auth
  errorWrongVerificationCode : {code: 103, message: "Wrong verification code!"},
  errorRequireCodeError : {code: 104, message: "Error while require code!"},
//Social
  errorDeleteUser : {code: 105, message: "Error while deleting user!"},
  errorFollowYourself : {code: 106, message: "You cannot follow yourself!"},
  errorAlredyFollowThisUser : {code: 107, message: "You alredy follows this user!"},
  errorFollowUserError : {code: 108, message: "Follow user error!"},
//Events
  errorVoteForMyEvent : {code: 109, message: "You cant vote for your event!"},
  errorVoteTwice : {code: 110, message: "You alredy vote for event!"},
  errorPayedEvent : {code: 111, message: "You should pay for this event!"},
  errorInviteYourself : {code: 112, message: "You cannot invite yourself!"},
  errorWrongPermission : {code: 113, message: "You doesnt have permissions for this operation!"},
  errorInviteDoesntExist : {code: 114, message: "Cant find this invite!"},
  errorInviteTwice : {code: 115, message: "You alredy invite this user!"},
};
