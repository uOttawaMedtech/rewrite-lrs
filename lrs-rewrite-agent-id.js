var TinCan = require('tincanjs');
var Config = require('./config.js');

var lrs = new TinCan.LRS(Config.record_store);

list_keys = function (err, result) {
  if (err === null) {
    console.log(result);
  } else {
    console.log(result);
  }
};

var state_keys = lrs.retrieveState(null,
  {
    activity: new TinCan.Activity({ id : Config.activity_id }),
    agent: new TinCan.Agent({ mbox: Config.agent_mbox }),
    callback: list_keys
  }
);
