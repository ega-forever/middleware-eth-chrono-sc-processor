const config = require('../../config');
module.exports = async(channel, parseMessage) => {
    return new Promise(res  => {
        channel.consume(`app_${config.rabbit.serviceName}.chrono_sc_queue`, async (message) => {
            await parseMessage(message, async() => {
                await channel.cancel(message.fields.consumerTag);
                res();
            });
        }, {noAck: true});
  });
}
