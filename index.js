/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Middleware service for handling emitted events on chronobank platform
 * @module Chronobank/eth-chrono-sc-processor
 * @requires models/accountModel
 * @requires config
 * @requires services/filterTxsBySMEventsService
 */

const config = require('./config'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  accountModel = require('./models/accountModel'),
  smEvents = require('./factories/sc/smartContractsEventsFactory'),
  filterTxsBySMEventsService = require('./services/filterTxsBySMEventsService'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'core.chronoSCProcessor'}),
  amqp = require('amqplib');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});


let init = async () => {

  mongoose.connection.on('disconnected', () => {
    throw new Error('mongo disconnected!');
  });

  const conn = await amqp.connect(config.rabbit.url);
  const channel = await conn.createChannel();

  channel.on('close', () => {
    throw new Error('rabbitmq process has finished!');
  });

  await accountModel.update({address: smEvents.address}, {$set: {address: smEvents.address}}, {
    upsert: true,
    setDefaultsOnInsert: true
  });

  await channel.assertExchange('events', 'topic', {durable: false});
  await channel.assertQueue(`app_${config.rabbit.serviceName}.chrono_sc_processor`);
  await channel.bindQueue(`app_${config.rabbit.serviceName}.chrono_sc_processor`, 'events', `${config.rabbit.serviceName}_transaction.${smEvents.address}`);

  channel.prefetch(2);

  // Listen to Rabbit
  channel.consume(`app_${config.rabbit.serviceName}.chrono_sc_processor`, async (data) => {
    try {
      let payload = JSON.parse(data.content.toString());

      if (!payload.blockNumber || payload.blockNumber === -1)
        return channel.ack(data);

      let filteredEvents = await filterTxsBySMEventsService(payload);

      for (let event of filteredEvents)
        channel.publish('events', `${config.rabbit.serviceName}_chrono_sc.${event.name.toLowerCase()}`, new Buffer(JSON.stringify(event)));

    } catch (err) {
      log.error(err);
    }

    channel.ack(data);
  });
};

module.exports = init().catch(err => {
  log.error(err);
  process.exit(0);
});
