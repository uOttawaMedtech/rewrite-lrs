var LRSRewriter;
var TinCan = require('tincanjs');
var orm = require('orm');
var relatedUUID = require('related-uuid');

(function () {
    "use strict";
    /**
    @class TinCan.LRS
    @constructor
    */

    LRSRewriter = function (lrs, issuer, callback) {
        this.log("constructor");

        this.lrs = null;

        this.schema = null;

        this.Job = null;

        this.Task = null;

        this.Attempt = null;

        this.numTasksQueued = 0;

        this.numTasksAttempted = 0;

        this.isAllTasksCompleted = false;

        this.isFetchingTasks = false;

        this.fetchTaskLimit = 100;

        this.dryrun = false;

        this.timer = null;

        this.init(lrs, issuer, callback);
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

        init: function (lrs, issuer, callback) {
            this.log("init");
            this.lrs = lrs;
            this.issuer = issuer
            var _this = this

            this.initJobsJournal(function(err) {
                if (err) return callback(err, null)
                callback(null, _this)
            });
        },

        initJobsJournal: function(callback) {
            var _this = this
            orm.connect('sqlite://./jobs.db', function (err, db) {
                if (err) throw err

                _this.Job = db.define('job', {
                    id:          { type: 'serial', key: true },
                    params:      { type: 'object', unique: true }
                })

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

                _this.Task.hasOne(   'job',  _this.Job,  { reverse: "tasks", autoFetch: true })
                _this.Attempt.hasOne('task', _this.Task, { reverse: "attempts" })

                db.sync(function(err, results){
                    if (err) return console.log("Error syncing the model: " + err)
                    callback(null)
                })
            })
        },

        addJobs: function(jobs, callback) {
            var _this = this
            if (0 == jobs.length) {
                var stepstaken = {}
                stepstaken.message = "No new jobs provided"
                return callback(null, stepstaken);
            }
            jobs.forEach(function(job) {
                var query_for = {
                    agent: new TinCan.Agent(job.old_agent)
                }
                var replace_with = {
                    agent: job.new_agent
                }
                _this.addJob(query_for, replace_with, callback)
            })
        },

        addJob: function(query_for, replace_with, callback) {
            var _this = this
            var stepstaken = {}

            var params = {
                query_for: query_for,
                replace_with: replace_with
            }

            // add the Job
            _this.Job.exists({ params: JSON.stringify(params) }, function (err, exists){
                if (err)
                    return console.log("Error checking if task exists: " + err)

                if (!exists) {
                    _this.Job.create({ params: params }, function(err, newjob) {
                        if (err) {
                            if (err.code == 'SQLITE_CONSTRAINT')
                                stepstaken.message = "Job already added"
                            else
                                return callback(err, null)
                        } else {
                            stepstaken.message = "Registered the job"

                            // find the job_id (can't trust newjob.id)
                            _this.Job.find({ params: JSON.stringify(params) }, 1, function(err, newjob) {
                                // add the first task
                                var cfg = {}
                                cfg.params = query_for

                                var queryStatementsTask = _this.prepareQueryStatementsTask(cfg)

                                queryStatementsTask.job_id = newjob[0].id

                                _this.Task.exists({ call: JSON.stringify(queryStatementsTask.call) }, function (err, exists){

                                    if (err)
                                        return console.log("Error checking if task exists: " + err)

                                    if (!exists) {
                                        _this.Task.create(queryStatementsTask, function(err, results) {
                                            if (err) {
                                                if (err.code == 'SQLITE_CONSTRAINT')
                                                    stepstaken.message = "Original task already registered"
                                                else
                                                    return callback(err, null)
                                            } else {
                                                stepstaken.message = "Registered the original task"
                                            }
                                            callback(null, stepstaken);
                                        });
                                    } else {
                                        stepstaken.message = "Original task already executed"
                                        callback(null, stepstaken);
                                    }
                                })
                            })
                        }
                    });
                } else {
                    stepstaken.message = "Job already added"
                    callback(null, stepstaken);
                }
            })

        },

        startTasks: function (callback) {
            var _this = this
            if (_this.timer) {
                return
            }
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
                _this.Task.find(conditions, _this.fetchTaskLimit, function(err, tasks){
                    if (0 == tasks.length) {
                        _this.isAllTasksCompleted = true
                        return
                    }
                    _this.numTasksQueued += tasks.length
                    tasks.forEach(function(task){
                        _this.callLRS(task, function(err_lrs, response){
                            _this.treatCallResponse(task, err_lrs, response, function(err_db, stepstaken){
                                var success = (err_lrs === null)
                                var notes = ''

                                if (err_db) {
                                    notes = err_db.toString()
                                } else if (err_lrs){
                                    notes = err_lrs + ": " + response.responseText
                                } else {
                                    notes = stepstaken.message
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

        callLRS: function(task, callback) {
            var call = task.call
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
                case 'saveStatement':
                    var cfg = {
                        callback: callback
                    }
                    var statement = call.params[0];
                    if (statement.authority === null) {
                        delete statement.authority
                    }
                    statement = new TinCan.Statement(statement)

                    this.lrs.saveStatement(
                        statement,
                        cfg
                    )
                    break
                default:
                    callback(null, {})
                    break
            }
        },

        treatCallResponse: function (task, err, response, callback) {
            var stepstaken = {}
            var tasks = []
            var _this = this
            if (err)
                callback(err, null)

            var call = task.call

            switch(call.method) {
                case 'queryStatements':
                case 'moreStatements':
                    if (response.more) {
                        tasks.push(this.prepareMoreStatementsTask(response.more))
                    }
                    if (response.statements) {
                        response.statements.forEach(function(statement){
                            tasks.push(_this.prepareReissueStatementTask(statement, task.job.params.replace_with))
                            tasks.push(_this.prepareVoidStatementTask(statement))

                            if (statement.target instanceof TinCan.Activity) {
                                // check for state entries without the registration id
                                tasks.push(_this.prepareRetrieveStateEntriesTask({
                                    agent: (statement.agent)? statement.agent: statement.actor,
                                    activity: statement.target
                                }))

                                if (statement.context && statement.context.registration) {
                                    // check for state entries matching the registration id
                                    tasks.push(_this.prepareRetrieveStateEntriesTask({
                                        agent: (statement.agent)? statement.agent: statement.actor,
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
                        tasks.push(_this.prepareSaveStateEntryTask(call.params[0], response.contents, call.params[1], task.job.params.replace_with))

                        // register dropping the state entry
                        tasks.push(_this.prepareDropStateEntryTask(call.params[0], call.params[1]))
                    }
                    break
                case 'saveState':
                case 'dropState':
                case 'saveStatement':
                    break
            }

            if (tasks.length > 0) {
                var tasks_evaluated = 0
                var tasks_created = 0

                tasks.forEach(function(new_task){
                    _this.Task.exists({ call: JSON.stringify(new_task.call) }, function (err, exists){

                        if (err)
                            return console.log("Error checking if task exists: " + err)

                        if (!exists) {
                            new_task.job_id = task.job_id
                            _this.Task.create(new_task, function(err, results) {
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
            var voidstatement = new TinCan.Statement({
                actor: this.issuer,
                verb: new TinCan.Verb({
                    id: "http://adlnet.gov/expapi/verbs/voided",
                    "display":{
                        "en-US":"voided"
                    }
                }),
                target: new TinCan.StatementRef({
                    id: statement.id
                })
            })

            voidstatement.target.objectType = "StatementRef"

            return {
                type: 'write',
                description: "Voiding statement " + statement.id,
                call: {
                    method: 'saveStatement',
                    params: [voidstatement]
                }
            }
        },

        prepareReissueStatementTask: function(statement, replace_with) {
            var newstatement = this.clone(statement)
            newstatement.actor = this.merge(newstatement.actor, replace_with.agent);
            newstatement.id = this.generateReissuedUUID(newstatement.id)
            if (statement.originalJSON) {
                delete newstatement.originalJSON
            }

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

        prepareSaveStateEntryTask: function(key, value, cfg, replace_with) {
            var newcfg = this.clone(cfg);
            newcfg.agent = this.merge(newcfg.agent, replace_with.agent);
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
        },

        // http://stackoverflow.com/a/7574273/2414273
        clone: function(obj){
            if(obj == null || typeof(obj) != 'object')
                return obj;

            var temp = new obj.constructor();
            for(var key in obj)
                temp[key] = this.clone(obj[key]);

            return temp;
        },
        // http://stackoverflow.com/questions/1198962/merge-two-json-objects-programmatically
        merge: function(a, b) {
            for (var z in b) {
                a[z] = b[z];
            }
            return a;
        },
        generateReissuedUUID: function(uuid) {
            return relatedUUID(uuid, 'reissued')
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
