var LRSRewriter;
var orm = require('orm');

(function () {
    "use strict";
    /**
    @class TinCan.LRS
    @constructor
    */

    LRSRewriter = function (lrs) {
        this.log("constructor");

        this.lrs = null;

        this.schema = null;

        this.Task = null;

        this.Attempt = null;

        this.oldAgent = null;

        this.newAgent = null;

        this.init(lrs);
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

            this.initTaskJournal(function(err) {
                if (err) return callback(err, null)
                callback(null, this)
            });
        },

        initTaskJournal: function(callback) {

            orm('sqlite://./tasks.db', function (err, db) {
                if (err) throw err

                this.Task = db.define('task', {
                    id:          { type: 'serial', key: true },
                    call:        { type: 'object', unique: true },
                    completed:   { type: 'boolean', defaultValue: false, index: true },
                    type:        { type: 'enum', values: [ "Statement", "State" ], index: true },
                    description: { type: 'text' }
                })

                this.Attempt = db.define('attempt', {
                    id:          { type: 'serial', key: true },
                    date:        { type: 'date', time: true },
                    success:     { type: 'boolean', defaultValue: false, index: true },
                    notes:       { type: 'text' }
                })

            })



            this.Task.hasMany(this.Attempt, {as: 'attempts', foreignKey: 'task_id'})
            this.Attempt.belongsTo(this.Post, {as: 'task', foreignKey: 'task_id'})

            if (err) return callback(err)
            callback(null)
        },

        replaceAgent: function(oldAgent, newAgent, doneReplacingAgent) {
            this.log("oldAgent:" + JSON.stringify(oldAgent))
            this.log("newAgent:" + JSON.stringify(newAgent))
            var self = this

            this.lrs.queryStatements({
                params: {
                    agent: oldAgent
                },
                callback: function(err, response) {
                    if (err)
                        return console.log("Error occured fetching statements:" + err)
                    response.statements.forEach(function(statement){
                        // add statement to journal
                        // console.log(statement.target.definition)
                        var newstatement = statement
                        newstatement.actor = newAgent;

                        var task = new self.Task({
                            type: "Statement",
                            method: "saveStatement",
                            params: {
                                0: newstatement
                            },
                            description: "Re-issuing statement " + statement.id + " with new agent"
                        })

                        console.log(task)

                        self.Task.create(function(err) {
                            if (err)
                                console.log ("Error occured writing to the journal:" + err)
                        })

                        // issue a new statement with the new agent
                    })
                    doneReplacingAgent(null, true);
                }
            })
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
