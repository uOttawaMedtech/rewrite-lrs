var TinCan = require('tincanjs');
var LRSRewriter = require('./lib/lrsrewriter');
var Config = require('./config.js');

LRSRewriter.DEBUG = true;

var lrs = new TinCan.LRS(Config.record_store);
var rw = new LRSRewriter(lrs);

rw.replaceAgent(
    {
        agent: new TinCan.Agent({ mbox: Config.agent_mbox }),
    },
    {
        agent: new TinCan.Agent({ mbox: Config.new_agent_mbox }),
    }
);
