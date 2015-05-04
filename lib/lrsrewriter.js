var LRSRewriter;
var caminte = require('caminte');

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

        init: function (lrs) {
            this.log("init");
            this.lrs = lrs;

            this.initTaskJournal();
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
        },

        initTaskJournal: function() {
            Schema = caminte.Schema;
            var config = {
                driver     : "sqlite3",
                database   : "tasks.db"
            };

            this.schema = new Schema(config.driver, config)

            this.Task = this.schema.define('Task', {
                id: { type: this.schema.Integer },
                type: { type: this.schema.String, index: true },
                method: { type: this.schema.String },
                params: { type: this.schema.JSON },
                completed: { type: this.schema.Boolean, default: false, index: true },
                description: {type: this.schema.Text }
            }, {
                primaryKeys: ['id'],
                indexes: {
                    call: {
                        columns: 'method, params'
                    }
                }
            })

            this.Attempt = this.schema.define('Attempt', {
                id: { type: this.schema.Integer },
                date: { type: this.schema.Data, default: Date.now },
                success: { type: this.schema.Boolean, index: true },
                notes: { type: this.schema.Text }
            })

            this.Task.hasMany(this.Attempt, {as: 'attempts', foreignKey: 'task_id'})
            this.Attempt.belongsTo(this.Post, {as: 'task', foreignKey: 'task_id'})
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
