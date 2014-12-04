var LRSRewriter;

(function () {
    "use strict";
    /**
    @class TinCan.LRS
    @constructor
    */

    LRSRewriter = function (lrs) {
        this.log("constructor");

        this.lrs = null

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
        },

        replaceAgent: function(oldAgent, newAgent) {
            this.log("oldAgent:" + JSON.stringify(oldAgent));
            this.log("newAgent:" + JSON.stringify(newAgent));
        }

        // fetch_statements()
        //   fetch an initial list -> treat_statements(list_of_statements)

        // treat_statements(list_of_statements)
        //   for each statement
        //     issue a new statement with the new agent
        //       -> ensure_new_statement_written(confirmation_of_new_statement)
        //     issue check for state variables
        //       -> treat_state_variables(list_state_variables)
        //   fetch more statements -> treat_statements(list_of_statements)

        // ensure_new_statement_written(confirmation_of_new_statement)
        //   if (success)
        //     issue a void statement -> ensure_statement_voided(confirmation_of_void_statement)
        //   else
        //     issue a new statement with the new agent
        //       -> ensure_new_statement_written(confirmation_of_new_statement)

        // ensure_statement_voided(confirmation_of_void_statement)
        //   if (success)
        //     log("statement {statement_id} voided and re-issued with new agent")
        //   else
        //     issue a void statement -> ensure_statement_voided(confirmation_of_void_statement)

        // treat_state_variables(list_state_variables)
        //   for each state variable
        //     issue a new state variable with the new agent
        //       -> ensure_new_state_variable_written(confirmation_of_new_state_variable)

        // ensure_new_state_variable_written(confirmation_of_new_state_variable)
        //   if (success)
        //     issue deletion of state variable
        //       -> ensure_deletion_of_old_state_variable(confirmation_of_old_state_variable_deleted)
        //   else
        //     issue a new state variable with the new agent
        //       -> ensure_new_state_variable_written(confirmation_of_new_state_variable)

        // ensure_deletion_of_old_state_variable(confirmation_of_old_state_variable_deleted)
        //   if (success)
        //     log("state variable {state variable} on {activity_id + registration} deleted and re-issued with new agent")
        //   else
        //     issue deletion of state variable
        //       -> ensure_deletion_of_old_state_variable(confirmation_of_old_state_variable_deleted)
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
