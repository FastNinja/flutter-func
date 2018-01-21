const functions = require("firebase-functions");
const algoliasearch = require("algoliasearch");
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);

exports.updateCacheControl = require("./updateCacheControl.js");
exports.search = require("./search.js");
exports.searchMessages = require("./api.js").searchMessages;
exports.sendPushNotifications = require("./pushNotifications.js");
