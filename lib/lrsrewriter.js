var LRSRewriter;
var orm = require('orm');

(function () {
    "use strict";
    /**
    @class TinCan.LRS
    @constructor
    */

    LRSRewriter = function (lrs, callback) {
        this.log("constructor");

        this.lrs = null;

        this.schema = null;

        this.Task = null;

        this.Attempt = null;

        this.oldAgent = null;

        this.newAgent = null;

        this.numTasksQueued = 0;

        this.numTasksAttempted = 0;

        this.isAllTasksCompleted = false;

        this.isFetchingTasks = false;

        this.dryrun = false;

        this.timer = null;

        this.init(lrs, callback);
    }

    LRSRewriter.prototype = {
        LOG_SRC: "LRSRewriter",

        /**
        Safe version of logging, only displays when .DEBUG is true, and console.log
        is available

        @method log
        @param {String} msg Message to output
        */
        log: function (msg, src) {
          /* globals console */
          if (LRSRewriter.DEBUG && typeof console !== "undefined" && console.log) {
            src = src || this.LOG_SRC || "LRSRewriter";

            console.log(src + ": " + msg);
          }
        },

        init: function (lrs, callback) {
            this.log("init");
            this.lrs = lrs;
            var _this = this

            this.initTaskJournal(function(err) {
                if (err) return callback(err, null)
                callback(null, _this)
            });
        },

        initTaskJournal: function(callback) {
            var _this = this
            orm.connect('sqlite://./tasks.db', function (err, db) {
                if (err) throw err

                _this.Task = db.define('task', {
                    id:          { type: 'serial', key: true },
                    completed:   { type: 'boolean', defaultValue: false, index: true },
                    type:        { type: 'enum', values: [ "read", "write" ], index: true },
                    description: { type: 'text' },
                    call:        { type: 'object', unique: true }
                })

                _this.Attempt = db.define('attempt', {
                    id:          { type: 'serial', key: true },
                    date:        { type: 'date', time: true, defaultValue: Date.now },
                    success:     { type: 'boolean', defaultValue: false, index: true },
                    notes:       { type: 'text' }
                })

                _this.Attempt.hasOne('task', _this.Task, { reverse: "attempts" })

                db.sync(function(err, results){
                    if (err) return console.log("Error syncing the model: " + err)
                    callback(null)
                })
            })
        },

        replaceAgent: function(oldAgent, newAgent, doneReplacingAgent) {
            this.log("oldAgent:" + JSON.stringify(oldAgent))
            this.log("newAgent:" + JSON.stringify(newAgent))
            var _this = this

            this.lrs.queryStatements({
                params: {
                    agent: oldAgent
                },
                callback: function(err, response) {
                    if (err)
                        return console.log("Error occured fetching statements:" + err)
                    if (response.more) {
                        var cfg = {}
                        cfg.url = response.more
                        var moreStatements = {
                            type: 'read',
                            description: "Fetching more statements",
                            call: {
                                method: 'moreStatements',
                                params: {
                                    0: cfg
                                }
                            }
                        }

                        _this.Task.create(moreStatements, function(err, results) {
                            if (err)
                                return console.log("Error occured writing to the journal:" + err)
                            console.log("Created the task (read): " + results.description)
                        });
                    }
                    response.statements.forEach(function(statement){
                        // add statement to journal
                        // console.log(statement.target.definition)
                        var newstatement = statement
                        newstatement.actor = newAgent;

                        var reissueStatement = {
                            type: 'write',
                            description: "Re-issuing statement " + statement.id + " with new agent",
                            call: {
                                method: 'saveStatement',
                                params: {
                                    0: newstatement
                                }
                            }
                        }

                        _this.Task.create(reissueStatement, function(err, results) {
                            if (err)
                                return console.log("Error occured writing to the journal:" + err)
                            console.log("Created the task (write): " + results.description)
                        });

                    })
                    doneReplacingAgent(null, true);
                }
            })
        },

        startTasks: function (callback) {
            var _this = this
            _this.timer = setInterval(function(){
                if (_this.isAllTasksCompleted) {
                    callback(null, _this.numTasksAttempted, _this.numTasksQueued)
                    clearInterval(_this.timer)
                    console.log("cancelled the task runner")
                    return
                }
                if (!_this.numTasksQueued)
                    console.log("started the task runner")
                _this.attemptTasks(callback)
            }, 500)
        },

        attemptTasks: function (callback) {
            var _this = this
            // fetch tasks if no tasks have been queued or we're done with current batch but not all tasks were marked as completed
            if (!_this.isFetchingTasks && (!_this.numTasksQueued || !_this.isAllTasksCompleted)) {
                var conditions = { completed: false }
                if (_this.dryrun)
                    conditions.type = 'read'
                _this.isFetchingTasks = true
                _this.Task.find(conditions, function(err, tasks){
                    if (0 == tasks.length) {
                        _this.isAllTasksCompleted = true
                        return
                    }
                    _this.numTasksQueued += tasks.length
                    tasks.forEach(function(task){
                        var randomSuccess = Math.random() >= 0.5
                        var notes = '';
                        if (randomSuccess)
                            notes = "Completed task " + task.id
                        else
                            notes = "Ran into a problem with task " + task.id
                        _this.Attempt.create({
                            task_id: task.id,
                            success: randomSuccess,
                            notes: notes
                        }, function(err, result){
                            if (err)
                                return console.log("Couldn't add an attempt")
                            if (randomSuccess) {
                                task.completed = randomSuccess
                                task.save(function(err){
                                })
                            }
                            _this.numTasksAttempted += 1
                            if (_this.numTasksQueued == _this.numTasksAttempted)
                                _this.isFetchingTasks = false
                        })
                    })
                })
            }
            callback(null, _this.numTasksAttempted, _this.numTasksQueued)
        }
    }

    /**
    @property DEBUG
    @static
    @default false
    */
    LRSRewriter.DEBUG = false;

    /**
    Turn on debug logging

    @method enableDebug
    @static
    */
    LRSRewriter.enableDebug = function () {
        LRSRewriter.DEBUG = true;
    };

    /**
    Turn off debug logging

    @method disableDebug
    @static
    */
    LRSRewriter.disableDebug = function () {
        LRSRewriter.DEBUG = false;
    };

    if (typeof module === "object") {
        module.exports = LRSRewriter;
    }
})();
