const requireAll = require('require-all'),
    contract = require('truffle-contract'),
    _ = require('lodash'),
    Promise = require('bluebird'),
    contracts = requireAll({
        dirname: _.nth(require.resolve('chronobank-smart-contracts/build/contracts/MultiEventsHistory').match(/.+(?=MultiEventsHistory)/), 0),
        filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/,
        resolve: Contract => contract(Contract)
    });


module.exports = async (web3, provider) => {
    const version = await Promise.promisify(web3.version.getNetwork)();
    const smEvents = require('../../controllers/eventsCtrl')(version, contracts);

    for (let contract_name in contracts) {
        if (contracts.hasOwnProperty(contract_name)) {
          try {
            contracts[contract_name].setProvider(provider);
            contracts[`${contract_name}Instance`] = await contracts[contract_name].deployed();
          } catch (e) {
  
          }
        }
    }

    return {smEvents, contracts};
  
}