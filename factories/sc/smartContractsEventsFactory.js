const _ = require('lodash'),
  contract = require('truffle-contract'),
  requireAll = require('require-all'),
  config = require('../../config'),
  fs = require('fs');
let contractsRaw = {};

if (fs.existsSync(config.smartContracts.path))
  contractsRaw = requireAll({ //scan dir for all smartContracts, excluding emitters (except ChronoBankPlatformEmitter) and interfaces
    dirname: config.smartContracts.path,
    filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/
  });

const multiEventHistoryAddress = _.get(contractsRaw, `${config.smartContracts.eventContract}.networks.${config.smartContracts.networkId}.address`);

let truffleContractEvents = _.chain(contractsRaw)
  .toPairs()
  .map(pair => contract(pair[1]).events)
  .transform((result, ev) => _.merge(result, ev), {})
  .toPairs()
  .map(pair => {
    let event = pair[1];
    event.signature = pair[0];
    return event;
  })
  .value();


let rawContractEvents = _.chain(contractsRaw)
  .map(contract =>
    _.chain(contract.networks)
      .values()
      .map(network => network.events)
      .flattenDeep()
      .values()
      .transform((result, item) => _.merge(result, item), {})
      .toPairs()
      .map(pair => {
        pair[1].signature = pair[0];
        return pair[1];
      })
      .value()
  )
  .flattenDeep()
  .value();

/**
 * @function
 * @description return available events for the specified network in config
 * @type {{events: *, address: *}}
 */
module.exports = {
  events: _.chain(truffleContractEvents)
    .union(rawContractEvents)
    .uniqBy('signature')
    .value(),
  address: multiEventHistoryAddress
};
