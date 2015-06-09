var TinCan = require('tincanjs');
var LRSRewriter = require('./lib/lrsrewriter');
var config = require('./config.json');
var jobs = require('./jobs.json');

LRSRewriter.DEBUG = true;

var lrs = new TinCan.LRS(config.record_store);
new LRSRewriter(lrs, new TinCan.Agent(config.issuer), function(err, rw) {
    console.log('Done initiating the database')
    rw.dryrun = config.dryrun || false
    rw.addJobs(
        jobs,
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
