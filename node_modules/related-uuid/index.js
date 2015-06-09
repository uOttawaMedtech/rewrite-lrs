var crypto = require('crypto');
var uuid = require('node-uuid');

module.exports = relatedUUID;

function relatedUUID(baseUUID, constantKey) {
    var consistentString = constantKey + '-' + baseUUID;
    var consistentHash = crypto.createHash('sha1').update(consistentString).digest('hex');
    return uuid.unparse(uuid.parse(consistentHash));
}
