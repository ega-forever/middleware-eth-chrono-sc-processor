const config = require('../../config');

module.exports = async (channel) => {
    await channel.assertExchange('events', 'topic', {durable: false});
    const processorQueue = await channel.assertQueue(`app_${config.rabbit.serviceName}.chrono_sc_queue`);
    await channel.bindQueue(`app_${config.rabbit.serviceName}.chrono_sc_queue`, 'events', `${config.rabbit.serviceName}_chrono_sc.*`);
    return processorQueue;
};