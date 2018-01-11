const functions = require("firebase-functions");
const algoliasearch = require("algoliasearch");
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// [START init_algolia]
// Initialize Algolia, requires installing Algolia dependencies:
// https://www.algolia.com/doc/api-client/javascript/getting-started/#install
//
// App ID and API Key are stored in functions config variables
const ALGOLIA_ID = functions.config().algolia.app_id;
const ALGOLIA_ADMIN_KEY = functions.config().algolia.api_key;
const ALGOLIA_SEARCH_KEY = functions.config().algolia.search_key;

const ALGOLIA_INDEX_NAME = "messages";
const client = algoliasearch(ALGOLIA_ID, ALGOLIA_ADMIN_KEY);
// [END init_algolia]

// Updates the search index when new blog entries are created or updated.
exports.onMessageCreated = functions.database
  .ref("/jobMessages/{jobId}/{messageId}")
  .onWrite(event => {
    const index = client.initIndex(ALGOLIA_INDEX_NAME);
    const message = event.data.val();

    const firebaseObject = {
      fullMessage: message,
      text: message.text,
      type: message.type,
      createdBy: message.createdBy,
      createdByUid: message.createdByUid,
      createdOn: toEpochDateTime(message.createdOn),
      jobId: event.params.jobId,
      objectID: event.params.messageId
    };

    return index.saveObject(firebaseObject).then(
      () => console.log("updated search index OK")
      // event.data.adminRef.parent
      //   .child("last_index_timestamp")
      //   .set(Date.parse(event.timestamp)
    );
  });

exports.sendPushNotification = functions.database
    .ref("/jobMessages/{jobId}/{messageId}")
    .onWrite(event => {
      const message = event.data.val();
      const userId = message.createdByUid;
      console.log('We have a new notification for user: ', userId);

      // Get the list of device notification tokens.
      const getDeviceTokensPromise = admin.database().ref(`/users/${userId}/notificationTokens`).once('value');

      // Get the user profile.
      const getMessagePromise = message.text;

      return Promise.all([getDeviceTokensPromise, getMessagePromise]).then(results => {
        const tokensSnapshot = results[0];
        const txt = results[1];

      // Check if there are any device tokens.
      if (!tokensSnapshot.hasChildren()) {
        return console.log('There are no notification tokens to send to.');
      }

      console.log('There are', tokensSnapshot.numChildren(), 'tokens to send notifications to.');
      console.log('Fetched text ', txt);

      // Notification details.
      const payload = {
          notification: {
              title: 'Notification:',
              body: txt
          }
      };

      // Listing all tokens.
      const tokens = Object.keys(tokensSnapshot.val());

      // Send notifications to all tokens.
      return admin.messaging().sendToDevice(tokens, payload).then(response => {
        // For each message check if there was an error.
        const tokensToRemove = [];
        response.results.forEach((result, index) => {
          const error = result.error;
          if (error) {
            console.error('Failure sending notification to', tokens[index], error);
            // Cleanup the tokens who are not registered anymore.
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                tokensToRemove.push(tokensSnapshot.ref.child(tokens[index]).remove());
            }
          }
        });

        return Promise.all(tokensToRemove);
      });
    });
  });

function toEpochDateTime(utcDateTime) {
  // Algolia required Date time stamp to be in Epoch.
  return Math.floor(new Date(utcDateTime).getTime() / 1000);
}

// [START update_index_function]
// Update the search index every time a blog post is written.
// exports.onNoteCreated = functions.firestore
//   .document("notes/{noteId}")
//   .onCreate(event => {
//     // Get the note document
//     const note = event.data.data();

//     // Add an 'objectID' field which Algolia requires
//     note.objectID = event.params.noteId;

//     // Write to the algolia index
//     const index = client.initIndex(ALGOLIA_INDEX_NAME);
//     return index.saveObject(note);
//   });
// // [END update_index_function]

// [START get_firebase_user];

function getFirebaseUser(req, res, next) {
  console.log("Check if request is authorized with Firebase ID token");

  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer ")
  ) {
    console.error(
      "No Firebase ID token was passed as a Bearer token in the Authorization header.",
      "Make sure you authorize your request by providing the following HTTP header:",
      "Authorization: Bearer <Firebase ID Token>"
    );
    res.status(403).send("Unauthorized");
    return;
  }

  let idToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    console.log('Found "Authorization" header');
    idToken = req.headers.authorization.split("Bearer ")[1];
  }

  admin
    .auth()
    .verifyIdToken(idToken)
    .then(decodedIdToken => {
      console.log("ID Token correctly decoded", decodedIdToken);
      req.user = decodedIdToken;
      next();
    })
    .catch(error => {
      console.error("Error while verifying Firebase ID token:", error);
      res.status(403).send("Unauthorized");
    });
}
// [END get_firebase_user]

// [START get_algolia_user_token]
// This complex HTTP function will be created as an ExpressJS app:
// https://expressjs.com/en/4x/api.html
const app = require("express")();

// We'll enable CORS support to allow the function to be invoked
// from our app client-side.
app.use(require("cors")({ origin: true }));

// Then we'll also use a special 'getFirebaseUser' middleware which
// verifies the Authorization header and adds a `user` field to the
// incoming request:
// https://gist.github.com/abehaskins/832d6f8665454d0cd99ef08c229afb42
//app.use(getFirebaseUser);

app.get("/search", (req, res) => {
  const index = client.initIndex(ALGOLIA_INDEX_NAME);

  var searchCriteria = req.query.messageText;

  if (!searchCriteria || searchCriteria == "") {
    res.json([]);
  }

  index.search(searchCriteria, function(err, content) {
    console.log(content);
    // Then return this key as {key: '...key'}
    res.json(content);
  });
});

// Add a route handler to the app to generate the secured key
// app.get("/generateKey", (req, res) => {
//   // Create the params object as described in the Algolia documentation:
//   // https://www.algolia.com/doc/guides/security/api-keys/#generating-api-keys
//   const params = {
//     // This filter ensures that only documents where author == user_id will be readable
//     //    filters: `author:${req.user.user_id}`,
//     // We also proxy the user_id as a unique token for this key.
//     userToken: req.user.user_id
//   };

//   // Call the Algolia API to generate a unique key based on our search key
//   const key = client.generateSecuredApiKey(ALGOLIA_SEARCH_KEY, params);

//   // Then return this key as {key: '...key'}
//   res.json({ key });
// });

// Finally, pass our ExpressJS app to Cloud Functions as a function
// called 'getSearchKey';
//exports.getSearchKey = functions.https.onRequest(app);
// [END get_algolia_user_token]

exports.searchMessages = functions.https.onRequest(app);
