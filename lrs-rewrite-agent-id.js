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

var result = lrs.retrieveState(Config.stateId,
  {
    activity: new TinCan.Activity({ id : Config.activity_id }),
    agent: new TinCan.Agent({ mbox: Config.agent_mbox }),
    registration: Config.registration,
    callback: list_keys
  }
);
