const functions = require("firebase-functions");
const algoliasearch = require("algoliasearch");
const admin = require("firebase-admin");

//
// Trigger - Added New Message
// Action - create and Push notificaiton to all users
// Details:
// use Firebase FCM to send push notifications. Later only mentioned users will be notified
//
exports.onNewMessageCreated = functions.database
  .ref("/jobMessages/{jobId}/{messageId}")
  .onWrite(event => {
    admin
      .database()
      .ref("/users")
      .once("value", function(snapshot) {
        snapshot.forEach(function(childSnapshot) {
          const message = event.data.val();
          var userId = childSnapshot.key;
          var email = message.createdBy;
          console.log("We have a new notification for user: ", userId);
          sendTokenToUserId(userId, message.text, email);
        });
      });
  });

function sendTokenToUserId(userId, getMessagePromise, email) {
  const getDeviceTokensPromise = admin
    .database()
    .ref(`/users/${userId}/notificationTokens`)
    .once("value");

  return Promise.all([getDeviceTokensPromise, getMessagePromise]).then(
    results => {
      const tokensSnapshot = results[0];
      const txt = results[1];
      // Check if there are any device tokens.
      if (!tokensSnapshot.hasChildren()) {
        return console.log("There are no notification tokens to send to.");
      }

      console.log(
        "There are",
        tokensSnapshot.numChildren(),
        "tokens to send notifications to for userId.",
        userId
      );

      // Notification details.
      const payload = {
        notification: {
          title: email,
          body: txt
        }
      };

      // Listing all tokens.
      const tokens = Object.keys(tokensSnapshot.val());

      // Send notifications to all tokens.
      return admin
        .messaging()
        .sendToDevice(tokens, payload)
        .then(response => {
          // For each message check if there was an error.
          const tokensToRemove = [];
          response.results.forEach((result, index) => {
            const error = result.error;
            if (error) {
              console.error(
                "Failure sending notification to",
                tokens[index],
                error
              );
              // Cleanup the tokens who are not registered anymore.
              if (
                error.code === "messaging/invalid-registration-token" ||
                error.code === "messaging/registration-token-not-registered"
              ) {
                tokensToRemove.push(
                  tokensSnapshot.ref.child(tokens[index]).remove()
                );
              }
            } else {
              console.log("Success sending notification to", tokens[index]);
            }
          });

          return Promise.all(tokensToRemove);
        });
    }
  );
}
