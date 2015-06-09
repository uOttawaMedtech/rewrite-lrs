# related-uuid

Create a consistent UUID based off another UUID and a key.

### When you want to consistently generated UUIDs for related entities from a thing that is addressable by a UUID

```js
  var relatedUUID = require('related-uuid')

  // ...

  var object = JSON.parse(jsonFromSomeOtherDataSource)

  var myRelatedObject = {
    uuid: relatedUUID(object.uuid, 'MyRelatedObject'),
    my: 'thing'
  }
```

Now every time you load the object from another data source and you return your related object your related object will have a UUID that stays consistent for that loaded object.

## Installation

`npm install related-uuid`

## Tests

`npm test`

## MIT Licensed
