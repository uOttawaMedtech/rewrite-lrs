var isValidUUID = require('lil-uuid').isUUID;
var relatedUUID = require('../index');
var test = require('cached-tape');
var uuid = require('node-uuid');

test('should provide a consistent UUID', function t(assert) {
    var value = uuid.v4();
    var relatedValue = relatedUUID(value, 'ConstantKey');
    assert.equal(isValidUUID(relatedValue), true);
    assert.equal(relatedValue, relatedUUID(value, 'ConstantKey'));
    assert.end();
});
