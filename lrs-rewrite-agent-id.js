var TinCan = require('tincanjs');
var Config = require('./config.js');

var lrs = new TinCan.LRS(Config.record_store);

output_result = function (err, result) {
  console.log( "\n\nretrieveState\n\n" );
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
    callback: output_result
  }
);

test_save = function () {
  var result = lrs.saveState('test-save-delete', Date.now(),
    {
      activity: new TinCan.Activity({ id : Config.activity_id }),
      agent: new TinCan.Agent({ mbox: Config.agent_mbox }),
      registration: Config.registration,
      callback: test_retrieve_after_save
    }
  );
}

test_retrieve_after_save = function(err, result) {
  var result = lrs.retrieveState(null,
    {
      activity: new TinCan.Activity({ id : Config.activity_id }),
      agent: new TinCan.Agent({ mbox: Config.agent_mbox }),
      registration: Config.registration,
      callback: test_retrieve_after_save_output
    }
  );
}

test_retrieve_after_save_output = function (err, result) {
  console.log( "\n\nsaveState test-save-delete\n\n" );
  if (err === null) {
    console.log(result);
  } else {
    console.log(result);
  }

  test_delete();
};

test_delete = function() {
  var result = lrs.dropState('test-save-delete',
    {
      activity: new TinCan.Activity({ id : Config.activity_id }),
      agent: new TinCan.Agent({ mbox: Config.agent_mbox }),
      registration: Config.registration,
      callback: test_retrieve_after_delete
    }
  );
}

test_retrieve_after_delete = function(err, result) {
  var result = lrs.retrieveState(null,
    {
      activity: new TinCan.Activity({ id : Config.activity_id }),
      agent: new TinCan.Agent({ mbox: Config.agent_mbox }),
      registration: Config.registration,
      callback: test_retrieve_after_delete_output
    }
  );
}

test_retrieve_after_delete_output = function (err, result) {
  console.log( "\n\ndropState test-save-delete\n\n" );
  if (err === null) {
    console.log(result);
  } else {
    console.log(result);
  }
};

test_save();
