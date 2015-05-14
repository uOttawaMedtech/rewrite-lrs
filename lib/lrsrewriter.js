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

            this.oldAgent = oldAgent
            this.newAgent = newAgent

            var cfg = {}
            cfg.params = {
                agent: oldAgent
            }

            var queryStatementsTask = _this.prepareQueryStatementsTask(cfg)

            _this.Task.exists({ call: JSON.stringify(queryStatementsTask.call) }, function (err, exists){

                if (err)
                    return console.log("Error checking if task exists: " + err)

                if (!exists) {
                    _this.Task.create(queryStatementsTask, function(err, results) {
                        if (err) {
                            if (err.code == 'SQLITE_CONSTRAINT')
                                stepstaken.message = "Original task to replace an agent already registered"
                            else
                                return doneInitReplaceAgent(err, null)
                        } else {
                            stepstaken.message = "Registered the original task to replace an agent"
                        }
                        doneInitReplaceAgent(null, stepstaken);
                    });
                } else {
                    stepstaken.message = "Original task to replace an agent already executed"
                    doneInitReplaceAgent(null, stepstaken);
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
                        _this.callLRS(task.call, function(err_lrs, response){
                            _this.treatCallResponse(task.call, err_lrs, response, function(err_db, stepstaken){
                                var success = (err_lrs === null)
                                var notes = ''

                                if (err_db) {
                                    notes = err_db.toString()
                                } else {
                                    notes = err_lrs || stepstaken.message
                                }

                                var attempt = {
                                    task_id: task.id,
                                    success: success,
                                    notes: notes
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
                case 'retrieveStateEntries':
                    var cfg = this.getParamsFromJSON(call.params[0])
                    cfg.callback = callback
                    this.lrs.retrieveState(null, cfg)
                    break
                case 'retrieveState':
                    var cfg = this.getParamsFromJSON(call.params[1])
                    cfg.callback = callback
                    this.lrs.retrieveState(call.params[0], cfg)
                    break
                case 'saveState':
                    var cfg = this.getParamsFromJSON(call.params[2])
                    cfg.callback = callback
                    this.lrs.saveState(call.params[0], call.params[1], cfg)
                    break
                case 'dropState':
                    var cfg = this.getParamsFromJSON(call.params[1])
                    cfg.callback = callback
                    this.lrs.dropState(call.params[0], cfg)
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
                        tasks.push(this.prepareMoreStatementsTask(response.more))
                    }
                    if (response.statements) {
                        response.statements.forEach(function(statement){
                            tasks.push(_this.prepareReissueStatementTask(statement))

                            if (statement.target instanceof TinCan.Activity) {
                                // check for state entries without the registration id
                                tasks.push(_this.prepareRetrieveStateEntriesTask({
                                    agent: _this.oldAgent,
                                    activity: statement.target
                                }))

                                if (statement.context && statement.context.registration) {
                                    // check for state entries matching the registration id
                                    tasks.push(_this.prepareRetrieveStateEntriesTask({
                                        agent: _this.oldAgent,
                                        activity: statement.target,
                                        registration: statement.context.registration
                                    }))
                                }
                            }

                        })
                    }
                    break
                case 'retrieveStateEntries':
                    if (response.contents) {
                        response.contents.forEach(function(stateEntry){
                            tasks.push(_this.prepareRetrieveStateEntryTask(stateEntry, call.params[0]))
                        })
                    }
                    break
                case 'retrieveState':
                    if (response.contents) {
                        // register saving the state entry under the new agent
                        tasks.push(_this.prepareSaveStateEntryTask(call.params[0], response.contents, call.params[1]))

                        // register dropping the state entry
                        tasks.push(_this.prepareDropStateEntryTask(call.params[0], call.params[1]))
                    }
                    break
                case 'saveState':
                case 'dropState':
                    break
                case 'sendStatement':
                    break
            }

            if (tasks.length > 0) {
                var tasks_evaluated = 0
                var tasks_created = 0

                tasks.forEach(function(task){
                    _this.Task.exists({ call: JSON.stringify(task.call) }, function (err, exists){

                        if (err)
                            return console.log("Error checking if task exists: " + err)

                        if (!exists) {
                            _this.Task.create(task, function(err, results) {
                                if (err) {
                                    // ignore errors on uniques (caused by async delay between check for whether the entry exists and creating the entry)
                                    if (err.code != 'SQLITE_CONSTRAINT')
                                        return callback(err, null)
                                }
                                tasks_evaluated += 1
                                tasks_created += 1
                                if (tasks_evaluated == tasks.length) {
                                    stepstaken.message = call.method + " => Created " + tasks_created + " tasks (" + (tasks_evaluated - tasks_created) + " tasks(s) previously registered)"
                                    callback(null, stepstaken)
                                }
                            });
                        } else {
                            tasks_evaluated += 1
                            if (tasks_evaluated == tasks.length) {
                                stepstaken.message = call.method + " => Created " + tasks_created + " tasks (" + (tasks_evaluated - tasks_created) + " tasks(s) previously registered)"
                                callback(null, stepstaken)
                            }
                        }
                    })
                })

            } else {
                stepstaken.message = call.method + " => No further steps taken"
                callback(null, stepstaken)
            }

        },

        prepareQueryStatementsTask: function(cfg) {
            return {
                type: 'read',
                description: "Fetching initial set of statements",
                call: {
                    method: 'queryStatements',
                    params: [cfg]
                }
            }
        },

        prepareMoreStatementsTask: function(url) {
            var cfg = {}
            cfg.url = url
            return {
                type: 'read',
                description: "Fetching more statements",
                call: {
                    method: 'moreStatements',
                    params: [cfg]
                }
            }
        },

        prepareVoidStatementTask: function(statement) {

        },

        prepareReissueStatementTask: function(statement) {
            var newstatement = statement
            newstatement.actor = this.newAgent;

            return {
                type: 'write',
                description: "Re-issuing statement " + statement.id + " with new agent",
                call: {
                    method: 'saveStatement',
                    params: [newstatement]
                }
            }
        },

        prepareRetrieveStateEntriesTask: function(cfg) {
            var description = "Retrieving state entries for activity " + cfg.activity.id

            var newcfg = {
                agent: cfg.agent,
                activity: {
                    id: cfg.activity.id
                }
            }

            if (cfg.registration) {
                description += " with registration " + cfg.registration
                newcfg.registration = cfg.registration
            }

            return {
                type: 'read',
                description: description,
                call: {
                    method: 'retrieveStateEntries',
                    params: [newcfg]
                }
            }
        },

        prepareRetrieveStateEntryTask: function(key, cfg) {
            var description = "Retrieving state entry '" + key + "' for activity " + cfg.activity.id
            if (cfg.registration) {
                description += " with registration " + cfg.registration
            }

            return {
                type: 'read',
                description: description,
                call: {
                    method: 'retrieveState',
                    params: [key, cfg]
                }
            }
        },

        prepareSaveStateEntryTask: function(key, value, cfg) {
            var newcfg = cfg;
            newcfg.agent = this.newAgent
            var description = "Saving new state entry '" + key + "' for activity " + cfg.activity.id
            if (cfg.registration) {
                description += " with registration " + cfg.registration
            }

            return {
                type: 'write',
                description: description,
                call: {
                    method: 'saveState',
                    params: [key, value, cfg]
                }
            }
        },

        prepareDropStateEntryTask: function(key, cfg) {
            var description = "Dropping state entry '" + key + "' for activity " + cfg.activity.id
            if (cfg.registration) {
                description += " with registration " + cfg.registration
            }

            return {
                type: 'write',
                description: description,
                call: {
                    method: 'dropState',
                    params: [key, cfg]
                }
            }
        },

        getParamsFromJSON: function(params) {
            var newparams = {}
            for(var param in params){
                switch(param) {
                    case 'agent':
                        newparams.agent = new TinCan.Agent(params[param])
                        break;
                    case 'activity':
                        newparams.activity = new TinCan.Activity(params[param])
                        break;
                    default:
                        newparams.param = params[param]
                        break;
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
