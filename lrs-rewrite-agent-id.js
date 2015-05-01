var TinCan = require('tincanjs');
var LRSRewriter = require('./lib/lrsrewriter');
var Config = require('./config.js');

LRSRewriter.DEBUG = true;

var lrs = new TinCan.LRS(Config.record_store);
var rw = new LRSRewriter(lrs);

rw.replaceAgent(
    new TinCan.Agent({ mbox: Config.agent_mbox }),
    new TinCan.Agent({ mbox: Config.new_agent_mbox }),
    function(err, success) {
        if (err)
            return console.log("An error has occured")

        if (success)
        console.log("Done fetching agents for the following statements")

    }
);
