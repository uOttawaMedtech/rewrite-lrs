# Rewrite an Agent's ID in an LRS

This utility will modify a learner's identification in an LRS by rewriting statements and state information with new the 'agent' identification (and voiding statements with the old identification).

## Requirements

* [nodejs](https://nodejs.org)
* [SQLPro for SQLite](https://www.sqlitepro.com) to inspect the jobs journal

## Install

    git clone https://github.com/uOttawaMedtech/rewrite-lrs.git
    npm install

## How to configure rewrite jobs

1. Copy `jobs.json.template` to `jobs.json` and configure the current and new agent information for each job
2. Copy `config.json.template` to `config.json`. Add your own info as the `issuer` and add the LRS credentials

## Dry run to create the inventory (optional)

1. Set `dryrun` to `true` in `config.json`
2. Run `node rewrite-lrs`
3. Inspect the jobs journal by opening `jobs.db`

## Run the rewrite

    `node rewrite-lrs`

You can cancel at any time using Ctrl-C. Run the command again to pick up where it left off.
