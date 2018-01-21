const functions = require("firebase-functions");
const admin = require("firebase-admin");

//
// Trigger - Storage On Change
// Action - Update metadata on Storage object - set CacheControl header
// Details:
// Update image cache headers - so image is preserved in local cache whend downloaded
// This is a workaround to force Mobile library library keep images for a long time once they are downloaded
// the proper solution will be to update FirebaseFlutter package that uploads images
// so it can set CacheControl when image is downloaded
//
exports.storageOnChanged = functions.storage.object().onChange(event => {
  const object = event.data; // The Storage object.

  const fileBucket = object.bucket; // The Storage bucket that contains the file.
  const filePath = object.name; // File path in the bucket.
  const contentType = object.contentType; // File content type.
  const resourceState = object.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
  const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.

  // Exit if this is a move or deletion event.
  if (resourceState === "not_exists") {
    console.log("This is a deletion event. ignore...");
    return "skip";
  }

  if (resourceState === "exists" && metageneration > 1) {
    console.log("This is a metadata change event. ignore...");
    return "skip";
  }

  var gcBucket = admin.storage().bucket();

  // Create file metadata to update - we need to set CacheControl so mobile will preserve these images
  var newMetadata = {
    cacheControl: "public, max-age=31536000"
  };

  return gcBucket
    .file(filePath)
    .setMetadata(newMetadata)
    .then(results => {
      console.log(`updated cache control:${filePath}`);
    })
    .catch(err => {
      console.error("ERROR:", err);
    });
});
