/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Filtering transactions by smart contract events
 *
 * @module services/filterTxsBySMEvents
 * @param {Object} tx Array of transactions
 * @param {Object} web3 Instance of Web3
 * @param {Object} multiAddress Instance of smart contract MultiAddress
 * @param {Object} smEvents Smart contract events
 * @returns {array} Array of filtered transactions
 */

const _ = require('lodash'),
  solidityEvent = require('web3/lib/web3/event.js');

module.exports = async (tx, web3, multiAddress, smEvents) => {

  if (_.get(tx, 'logs', []).length === 0)
    return [];

  return _.chain(tx.logs)
    .filter(log => multiAddress.address === log.address)
    .transform((result, ev) => {

      let signatureDefinition = smEvents.events[ev.topics[0]];
      if (!signatureDefinition)
        return;

      _.pullAt(ev, 0);
      let resultDecoded = new solidityEvent(null, signatureDefinition).decode(ev);

      result.push(_.chain(resultDecoded)
        .pick(['event', 'args'])
        .merge({args: {controlIndexHash: `${ev.logIndex}:${ev.transactionHash}`}})
        .thru(ev => ({
          name: ev.event,
          payload: new smEvents.eventModels[ev.event](ev.args)
        })
        )
        .value()
      );
    }, [])
    .value();

};
