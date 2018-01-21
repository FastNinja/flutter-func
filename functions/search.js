const functions = require("firebase-functions");
const admin = require("firebase-admin");
const algoliasearch = require("algoliasearch");

//
// Trigger - New Message is added to JobMessages folder
// Action - Push message text into Search engine so we can search it later using text
// Details:
//  Curently we are using Algolia as it allow to do search for free for small number of records (10K)
//  Once the limit is reached the alternatives will be to switch to Paid tier or to host your own Search Engine (will cost anyway)
//
// https://www.algolia.com/doc/api-client/javascript/getting-started/#install
//
const ALGOLIA_ID = functions.config().algolia.app_id;
const ALGOLIA_ADMIN_KEY = functions.config().algolia.api_key;
const ALGOLIA_SEARCH_KEY = functions.config().algolia.search_key;

const ALGOLIA_INDEX_NAME = "messages";
const client = algoliasearch(ALGOLIA_ID, ALGOLIA_ADMIN_KEY);

// Updates the search index when new blog entries are created or updated.
exports.onNewMessageCreated = functions.database
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

function toEpochDateTime(utcDateTime) {
  // Algolia required Date time stamp to be in Epoch.
  return Math.floor(new Date(utcDateTime).getTime() / 1000);
}
