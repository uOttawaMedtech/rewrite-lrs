var TinCan = require('tincanjs');

var LRS = TinCan.LRS;

(function () {
    "use strict";
    /**
    @class TinCan.LRS
    @constructor
    */

    var Rewriter = LRS.Rewriter = function (lrs) {
        this.log("constructor");

        this.lrs = null

        this.oldAgent = null;

        this.newAgent = null;

        this.init(lrs);
    }

    Rewriter.prototype = {
        LOG_SRC: "LRS.Rewriter",
        log: TinCan.prototype.log,

        init: function (lrs) {
            this.log("init");
            this.lrs = lrs;
        },

        replaceAgent: function(oldAgent, newAgent) {
            this.log("oldAgent:" + JSON.stringify(oldAgent));
            this.log("newAgent:" + JSON.stringify(newAgent));
        }
    }

    // RewriteAgent.prototype = {
    //     LOG_SRC: "rewriteAgent",
    //     log: TinCan.prototype.log,
    //
    //     run: function (oldAgent, newAgent) {
    //         this.log("rewriteAgent");
    //     }
    //
    //     // fetch_statements()
    //     //   fetch an initial list -> treat_statements(list_of_statements)
    //
    //     // treat_statements(list_of_statements)
    //     //   for each statement
    //     //     issue a new statement with the new agent
    //     //       -> ensure_new_statement_written(confirmation_of_new_statement)
    //     //     issue check for state variables
    //     //       -> treat_state_variables(list_state_variables)
    //     //   fetch more statements -> treat_statements(list_of_statements)
    //
    //     // ensure_new_statement_written(confirmation_of_new_statement)
    //     //   if (success)
    //     //     issue a void statement -> ensure_statement_voided(confirmation_of_void_statement)
    //     //   else
    //     //     issue a new statement with the new agent
    //     //       -> ensure_new_statement_written(confirmation_of_new_statement)
    //
    //     // ensure_statement_voided(confirmation_of_void_statement)
    //     //   if (success)
    //     //     log("statement {statement_id} voided and re-issued with new agent")
    //     //   else
    //     //     issue a void statement -> ensure_statement_voided(confirmation_of_void_statement)
    //
    //     // treat_state_variables(list_state_variables)
    //     //   for each state variable
    //     //     issue a new state variable with the new agent
    //     //       -> ensure_new_state_variable_written(confirmation_of_new_state_variable)
    //
    //     // ensure_new_state_variable_written(confirmation_of_new_state_variable)
    //     //   if (success)
    //     //     issue deletion of state variable
    //     //       -> ensure_deletion_of_old_state_variable(confirmation_of_old_state_variable_deleted)
    //     //   else
    //     //     issue a new state variable with the new agent
    //     //       -> ensure_new_state_variable_written(confirmation_of_new_state_variable)
    //
    //     // ensure_deletion_of_old_state_variable(confirmation_of_old_state_variable_deleted)
    //     //   if (success)
    //     //     log("state variable {state variable} on {activity_id + registration} deleted and re-issued with new agent")
    //     //   else
    //     //     issue deletion of state variable
    //     //       -> ensure_deletion_of_old_state_variable(confirmation_of_old_state_variable_deleted)
    //
    // }
    /*global module*/
    // Support the CommonJS method for exporting our single global
    if (typeof module === "object") {
        module.exports = TinCan;
    }
})();
