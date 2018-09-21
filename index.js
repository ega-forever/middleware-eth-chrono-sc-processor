/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Middleware service for handling emitted events on chronobank platform
 * @module Chronobank/eth-chrono-sc-processor
 */

const config = require('./config'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  accountModel = require('./models/accountModel'),
  smEvents = require('./factories/sc/smartContractsEventsFactory'),
  filterTxsBySMEventsService = require('./services/filterTxsBySMEventsService'),
  bunyan = require('bunyan'),
  AmqpService = require('middleware_common_infrastructure/AmqpService'),
  InfrastructureInfo = require('middleware_common_infrastructure/InfrastructureInfo'),
  InfrastructureService = require('middleware_common_infrastructure/InfrastructureService'),
  log = bunyan.createLogger({name: 'plugins.chronoSCProcessor', level: config.logs.level}),
  amqp = require('amqplib');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.accounts.uri, {useMongoClient: true});

const runSystem = async function () {
  const rabbit = new AmqpService(
    config.systemRabbit.url, 
    config.systemRabbit.exchange,
    config.systemRabbit.serviceName
  );
  const info = new InfrastructureInfo(require('./package.json'));
  const system = new InfrastructureService(info, rabbit, {checkInterval: 10000});
  await system.start();
  system.on(system.REQUIREMENT_ERROR, ({requirement, version}) => {
    log.error(`Not found requirement with name ${requirement.name} version=${requirement.version}.` +
        ` Last version of this middleware=${version}`);
    process.exit(1);
  });
  await system.checkRequirements();
  system.periodicallyCheck();
};

let init = async () => {
  if (config.checkSystem)
    await runSystem();

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

      let filteredEvents = filterTxsBySMEventsService(payload);

      for (let event of filteredEvents) {
        log.info(`emitted event ${event.name} on transaction ${payload.hash}`);
        channel.publish('events', `${config.rabbit.serviceName}_chrono_sc.${event.name.toLowerCase()}`, new Buffer(JSON.stringify(event)));
      }
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
