/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const _ = require('lodash'),
  smEvents = require('../factories/sc/smartContractsEventsFactory'),
  Web3 = require('web3');
web3 = new Web3();

/**
 * Filtering transactions by smart contract events
 *
 * @module services/filterTxsBySMEvents
 * @param {Object} tx - full eth transaction object (which is confirmed and includes logs)
 * @returns {array} Array of decoded events, extracted from logs
 */
module.exports = tx => {

  if (_.get(tx, 'logs', []).length === 0)
    return [];

  return _.chain(tx.logs)
    .filter(log => smEvents.address === log.address)
    .transform((result, log) => {

      let signatureDefinition = smEvents.events[log.topics[0]];
      if (!signatureDefinition)
        return;

      if (log.anonymous)
        _.pullAt(log.topics, 0);

      let resultDecoded = web3.eth.abi.decodeLog(signatureDefinition, log.data, log.topics);

      console.log(resultDecoded)

      result.push({
        info: {
          tx: tx.hash,
          blockNumber: tx.blockNumber
        },
        name: resultDecoded.event,
        payload: log.args
      });

    }, [])
    .value();
};
