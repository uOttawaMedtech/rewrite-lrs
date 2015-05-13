var LRSRewriter;
var TinCan = require('tincanjs');
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

        initReplaceAgent: function(oldAgent, newAgent, doneInitReplaceAgent) {
            this.log("oldAgent:" + JSON.stringify(oldAgent))
            this.log("newAgent:" + JSON.stringify(newAgent))
            var _this = this
            var stepstaken = {}

            this.newAgent = newAgent

            var cfg = {}
            cfg.params = {
                agent: oldAgent
            }

            var queryStatements = {
                type: 'read',
                description: "Fetching initial set of statements",
                call: {
                    method: 'queryStatements',
                    params: [cfg]
                }
            }

            _this.Task.create(queryStatements, function(err, results) {
                if (err)
                    return doneInitReplaceAgent(err, null)
                stepstaken.message = "Created the original task to replace an agent: " + JSON.stringify(results)
                doneInitReplaceAgent(null, stepstaken);
            });
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
                        _this.callLRS(task.call, function(err_lrs, response){
                            _this.treatCallResponse(task.call, err_lrs, response, function(err_db, stepstaken){
                                var success = (err_lrs === null)
                                var notes = err_lrs || stepstaken.message

                                var attempt = {
                                    task_id: task.id,
                                    success: success
                                }

                                _this.Attempt.create(attempt, function(err, result){
                                    if (err)
                                        return console.log("Couldn't add an attempt")
                                    if (success) {
                                        task.completed = success
                                        task.save(function(err){
                                        })
                                    }
                                    _this.numTasksAttempted += 1
                                    if (_this.numTasksQueued == _this.numTasksAttempted)
                                        _this.isFetchingTasks = false
                                })
                            })
                        })
                    })
                })
            }
            callback(null, _this.numTasksAttempted, _this.numTasksQueued)
        },

        callLRS: function(call, callback) {
            switch(call.method) {
                case 'queryStatements':
                    this.lrs.queryStatements({
                        params: this.getParamsFromJSON(call.params[0].params),
                        callback: callback
                    })
                    break
                case 'moreStatements':
                    this.lrs.moreStatements({
                        url: call.params[0].url,
                        callback: callback
                    })
                    break
                default:
                    callback(null, {})
                    break
            }
        },

        treatCallResponse: function (call, err, response, callback) {
            var stepstaken = {}
            var tasks = []
            var _this = this
            if (err)
                callback(err, null)

            switch(call.method) {
                case 'queryStatements':
                case 'moreStatements':
                    if (response.more) {
                        var cfg = {}
                        cfg.url = response.more
                        var moreStatements = {
                            type: 'read',
                            description: "Fetching more statements",
                            call: {
                                method: 'moreStatements',
                                params: [cfg]
                            }
                        }

                        tasks.push(moreStatements)
                    }
                    if (response.statements) {
                        response.statements.forEach(function(statement){
                            var newstatement = statement
                            newstatement.actor = _this.newAgent;

                            var reissueStatement = {
                                type: 'write',
                                description: "Re-issuing statement " + statement.id + " with new agent",
                                call: {
                                    method: 'saveStatement',
                                    params: [newstatement]
                                }
                            }

                            tasks.push(reissueStatement)
                        })
                    }
                    break;
            }

            if (tasks.length > 0) {
                _this.Task.create(tasks, function(err, results) {
                    if (err)
                        return callback(err, null)
                    stepstaken.message = "Created " + results.length + " tasks:" + JSON.stringify(results)
                    callback(null, stepstaken)
                });
            } else {
                stepstaken.message = 'No further steps taken'
                callback(null, stepstaken)
            }

        },

        getParamsFromJSON: function(params) {
            var newparams = {}
            for(var param in params){
                switch(param) {
                    case 'agent':
                        newparams.agent = new TinCan.Agent(params[param])
                        break;
                    default:
                        newparams.param = param
                }
            }
            return newparams
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
