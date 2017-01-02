'use strict';
var CesiumCore = require('cesium-core-experimental');

var defined = CesiumCore.defined;

module.exports = isDataUri;

/**
 * @private
 */
 function isDataUri(uri) {
    //Return false if the uri is undefined
    if (!defined(uri)) {
        return false;
    }

    //Return true if the uri is a data uri
    return /^data\:/i.test(uri);
 }