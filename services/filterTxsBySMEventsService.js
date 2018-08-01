/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const _ = require('lodash'),
  smEvents = require('../factories/sc/smartContractsEventsFactory'),
  solidityEvent = require('web3/lib/web3/event.js');

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
    .transform((result, ev) => {

      let signatureDefinition = smEvents.events[ev.topics[0]];
      if (!signatureDefinition)
        return;

      _.pullAt(ev, 0);
      let resultDecoded = new solidityEvent(null, signatureDefinition).decode(ev);

      result.push({
        name: resultDecoded.event,
        payload: ev.args
      });

    }, [])
    .value();
};
