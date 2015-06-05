var TinCan = require('tincanjs');
var LRSRewriter = require('./lib/lrsrewriter');
var Config = require('./config.js');

LRSRewriter.DEBUG = true;

var lrs = new TinCan.LRS(Config.record_store);
new LRSRewriter(lrs, new TinCan.Agent(Config.issuer), function(err, rw) {
    console.log('Done initiating the database')
    rw.dryrun = true
    rw.replaceAgent(
        new TinCan.Agent(Config.old_agent),
        new TinCan.Agent(Config.new_agent),
        function(err, stepstaken) {
            if (err)
                return console.log("An error has occured: " + err)

            console.log(stepstaken.message)

            rw.startTasks(function(err, numTasksCompleted, numTasksQueued){
                console.log("finished " + numTasksCompleted + " tasks of " + numTasksQueued + " queued")
            })
        }
    )
});
