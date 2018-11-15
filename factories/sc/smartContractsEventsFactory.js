/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const _ = require('lodash'),
  requireAll = require('require-all'),
  config = require('../../config'),
  Web3 = require('web3'),
  web3 = new Web3(),
  fs = require('fs');
let contractsRaw = {};

if (fs.existsSync(config.smartContracts.path))
  contractsRaw = requireAll({ //scan dir for all smartContracts, excluding emitters (except ChronoBankPlatformEmitter) and interfaces
    dirname: config.smartContracts.path,
    filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/
  });

const multiEventHistoryAddress = _.get(contractsRaw, `${config.smartContracts.eventContract}.networks.${config.smartContracts.networkId}.address`);


const contractEvents = _.chain(contractsRaw)
  .map(contract =>
    _.chain(contract.abi)
      .filter({type: 'event'})
      .map(ev => {
        ev.signature = web3.utils.sha3(`${ev.name}(${ev.inputs.map(input => input.type).join(',')})`);
        return ev;
      })
      .value()
  )
  .flattenDeep()
  .uniqBy('signature')
  .map(item=>[item.signature, item])
  .fromPairs()
  .value();

/**
 * @function
 * @description return available events for the specified network in config
 * @type {{events: *, address: *}}
 */
module.exports = {
  events: contractEvents,
  address: multiEventHistoryAddress
};
