/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Initialize all events for smartContracts
 * @module controllers/events
 * @requires utils/transformToFullName
 * @requires web3
 * @requires config
 */

const _ = require('lodash'),
  config = require('../config'),
  mongoose = require('mongoose');

/**
 * Initialize all events for smartContracts
 * @param  {array} contracts Instances of smartContracts
 * @return {Object}          {eventModels, signatures}
 */
module.exports = (contracts) => {

  let events = _.chain(contracts)
    .toPairs()
    .map(pair=>pair[1].events)
    .transform((result, ev)=>_.merge(result, ev))
    .value();

  let eventModels = _.chain(events)
    .toPairs()
    .map(pair => ({
      address: pair[0],
      inputs: pair[1].inputs,
      name: pair[1].name
    }))
    .groupBy('name')
    .map(ev => ({
      name: ev[0].name,
      inputs: _.chain(ev)
        .map(ev => ev.inputs)
        .flattenDeep()
        .uniqBy('name')
        .value()
    })
    )
    .transform((result, ev) => { //build mongo model, based on event definition from abi

      result[ev.name] = mongoose.model(ev.name, new mongoose.Schema(
        _.chain(ev.inputs)
          .transform((result, obj) => {
            result[obj.name] = {
              type: new RegExp(/uint/).test(obj.type) ?
                Number : mongoose.Schema.Types.Mixed
            };
          }, {})
          .merge({
            controlIndexHash: {type: String, unique: true, required: true},
            created: {type: Date, required: true, default: Date.now, expires: config.smartContracts.events.ttl}
          })
          .value()
      ));
    }, {})
    .value();

  return {events, eventModels};

};
